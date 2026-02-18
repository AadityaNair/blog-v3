---
title: HA Directory Server setup (Part -II)
tags: ["ldap", "linux"]
date: 2017-06-22
excerpt: |
  Moving to a more reliable setup with multiple servers.
  In this final part, we describe how we configure _failover_.
---

In the pervious [post], we configured the servers in multimaster mode. This assures us that both
the servers in the configuration have the same and latest data. In this part, we make sure that if
any one server fails, the entire load shifts to the other one.This technically is called _[failover]_.

The bird's eye view of what we are going to do below is we configure a shared IP across both our servers.
The directory server will be referenced through this shared IP by other applications. Whenever one of the
servers fail for any reason, this IP will be taken over by the other server. This way applications never
see a server fail except for the minor delay during IP switch.

### Pacemaker, Corosync and High-Availability

Currently, pacemaker/corosync combo is the go to solution for HA. It is simple enough for small setups while being
felexible enough for larger ones. In addition to great doumentation they also have a [nice tutorial] for beginners.
We will be using them for our setup.

Before you proceed, please read a bit about pacemaker architecture and what various terms mean in its context.
You will need those.

## Pre-Requisites

Setup **hostnames** for other servers. In each of the servers edit the `/etc/hosts` file and add the IPs and hostnames for
both self and the other server. This allows us to refer each server by a hostname and not by their IP.

```shell-session
$ cat /etc/hosts
192.168.122.10 ldap1
192.168.122.20 ldap2
```

Let the shared IP be `10.1.36.79`

Hosts must now be allowed to **SSH into each other**. Not particularly necessary, just nice to have. It will make it
easier when you have to move things around as we will see next.

Pacemaker authenticates as a **special user** for all its cluster management operations. If you installed things correctly,
a user `hacluster` has been created. In both machines, set the same password for the user using `passwd hacluster`.

Now for most of the setup's usage, you will refer to the server by its shared IP. So it would be nice if both the hosts
have **same host keys**. Host keys are used to identify a system to SSH and are generated during first-boot and is unique to the host.
If the host keys are not the same, SSH will throw an error saying that host keys differ. This will happen after a failover as the shared
IP now points to a different machine.
Sync host keys by replacing all the `/etc/ssh/ssh_host_*` files on one server with the same files as on the other one.

For most of our operation, we would like for a failed server to join the cluster as soon as it boots. To do so, make `pcsd` **run on boot**.
On a systemd machine, you would accomplish this by a `systemctl enable pcsd.service` from the root shell.

## Create the Cluster

To create the cluster we need the nodes to be authenticated for use by pacemaker before creating the actual cluster.
Pacemaker logs in by the `hacluster` user.

```shell-session
ldap1 $ pcs cluster auth ldap1 ldap2 -u hacluster -p password # Auth

ldap1 $ pcs cluster setup --name ldap_cluster ldap1 ldap2 # Actual cluster creation

ldap1 $ pcs cluster start --all
```

All of these commands should end wihout errors. Also note that all of pacemaker commands can be run from either of the nodes.
It would make no difference.

If everything went well, the cluster status should be similar to this:

```shell-session
ldap1 $ pcs status
Cluster name: ldap_cluster
Stack: corosync
Current DC: ldap2 (version 1.1.15-11.el7_3.4-e174ec8) - partition with quorum
Last updated: Thu Jun 21 12:32:48 2017          Last change: Tue Jun 13 17:05:13 2017 by root via cibadmin on ldap1

2 nodes and 0 resources configured

Online: [ ldap1 ldap2 ]

Full list of resources:

Daemon Status:
  corosync: active/enabled
  pacemaker: active/enabled
  pcsd: active/enabled

```

Since we are only a two-node cluster, we need to set some special properties.

- STONITH (Shoot The Other Node In The Head) ensures that a malfunctioning node doesn't corrupt the entire data. As the name
  hints, it does so by powering off the other node. Since one node is always on standby and doesn't work on data, we could disable
  _stonith_ by `bash^ pcs property set stonith-enabled=false`

- When a network issue splits a cluster into two connected components, a _quorum_ is used to resolve as to which part will be the
  master and which slave. By definition, quorum works with 3 or more nodes in cluster. Hence we disable doing anything when there is
  no quorum by `bash^ pcs property set no-quorum-policy=ignore`. Find a bit more information [here].

## Resources.

Read [this] to know a bit more about resources and resource agents. To put simply, a resource is anything managed by the cluster.
We will configure resources to switch IPs on failure and to stop and start 389-ds before and after the switch respectively.

### IP failover

Whenever a server goes down we need to make sure the other system gets the shared IP. Luckily, we have a default resource available to
accomplish this.

```shell-session
$ pcs resource create ldap_ip ocf:heartbeat:IPaddr2 ip=10.1.36.79 cidr_netmask=32 op monitor interval=10s
```

That's it. The IP will be moved whenever the current holder goes down. The resource monitors status every 10 sec as defined by the
`interval` option.

### Directory start/stop

The above operation should have been enough. But I had observed some random inconsistencies pop up after an IP switch. So I wanted that
the directory be stopped before the IP switch and started after. Sadly, we don't have resources available for that by default. Hence
I cooked up [two simple resources], one that stopped the directory and one that started it. Copy these to `/usr/lib/ocf/resource.d/nair`
on both servers. Now create the resources:

```shell-session
$ pcs resource create start_ldap ocf:nair:dirsrv_start
$ pcs resource create stop_ldap ocf:nair:dirsrv_stop
```

## Constraints

Just creating a resource is not enough. We also have to make sure that these resources run in the right place and in the right order. For example,
`dirsrv_stop` should never run after `dirsrv_start`. To accomplish this, pacemaker defines constraints.

- **Collocation constraints** are used to define where a resource will run with what priority. We use them to make sure that the directory
  restart is attempted only where the shared IP is now. No point in doing so on the other server.

```shell-session
$ pcs constraint colocation add stop_ldap with ldap_ip INFINITY
$ pcs constraint colocation add start_ldap with ldap_ip INFINITY
```

The command is pretty self-explanatory. But make sure that the order of resource names in the above command is important. To have `stop_ldap`
with `ldap_ip`, we need to know where `ldap_ip` is going to be beforehand, which is how things should be and not the other way round.

- We use **Order Constraints** to impose an ordering on resources' start and stop actions.
  We need to make sure that `stop_ldap` happens before `ldap_ip` which itself happens before `start_ldap`.

```shell-session
$ pcs constraint order stop_ldap then ldap_ip
$ pcs constraint order ldap_ip then start_ldap
```

Again the commands are pretty self explanatory.

Finally things should look like this.

```shell-session
$  pcs constraint --full
Location Constraints:
Ordering Constraints:
  start ldap_ip then start start_ldap (kind:Mandatory) (id:order-ldap_ip-start_ldap-mandatory)
  start stop_ldap then start ldap_ip (kind:Mandatory) (id:order-stop_ldap-ldap_ip-mandatory)
Colocation Constraints:
  start_ldap with ldap_ip (score:INFINITY) (id:colocation-start_ldap-ldap_ip-INFINITY)
  stop_ldap with ldap_ip (score:INFINITY) (id:colocation-stop_ldap-ldap_ip-INFINITY)
```

That's about it. Now the server should be accessible throgh the shared IP. You could test the failover in various ways.
To see if the directory is started/stopped correctly, run `watch -n 1 systemctl status dirsrv.target` on a server and watch what
happens as the other server goes down.

[failover]: https://en.wikipedia.org/wiki/Failover
[nice tutorial]: http://clusterlabs.org/doc/en-US/Pacemaker/1.1/html/Clusters_from_Scratch/
[here]: http://clusterlabs.org/doc/en-US/Pacemaker/1.1/html/Clusters_from_Scratch/_perform_a_failover.html
[this]: http://clusterlabs.org/doc/en-US/Pacemaker/1.1/html/Pacemaker_Explained/ch05.html#_what_is_a_cluster_resource
[two simple resources]: https://gist.github.com/AadityaNair/258b9cd11495acf23ebd8dcc39459313
[post]: /ldap-multimaster1
