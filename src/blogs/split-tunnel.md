---
title: Split a VPN
excerpt: How I allow only specific applications to use my VPN.
tags: ["networks"]
comments: true
date: 2017-11-23
---

Earlier this month, for various reasons (gaming, restrictive local connection, etc), I bought a VPN service.
I use openvpn to connect to the service.
Now, openvpn by default routes all traffic through the tunnel. This was not good for me because I still wanted to
access local resources.

Openvpn does have a property where locally destined packet won't go through a VPN while the rest
of them do. This allows me to, say, SSH into a local machine while having a P2P application running in
the background. But it doesn't allow for fine grained control over what applications use the service.

That is what I am aiming for.
*Much of this post is a modified/simpler version of [this] blog post.*

## Pre-requisites
Almost all of this post deals with *iptables* and *routing*, especially policy routing. So I am assuming that you are
aware of how those work in linux and are atleast familiar with the commands that modify them (`iptables *` and `ip route` ).
You are also aware of a bit on *TCP*/*UDP* protocols and the concept of ports.

Let's move on to the actual content.

## Split Tunnelling a network connection
So, what we are going to do is a lot of *iptables* black magic. It has a module that can detect what linux user is
associated with the application that is sending the packets. Hence we will create a user that is allowed to use
VPN and send all packets from that user through the VPN.

### One time stuff: Create users and the rule table.
Create a separate user which will access the VPN.
```sh
$ adduser -c "Split Tunnel User" -M -s /bin/bash stunnel
```

Also edit the `/etc/iproute2/rt_tables` file to add a new rule table. Mine now looks like this:
```sh
255 local
254 main
253 default
200 vpn
```


### Creating the tunnel
Now you will need to actually start the openvpn client and connect to the server.
```sh
$ sudo openvpn --route-noexec --config config.ovpn
```

Note that the `--route-noexec` parameter is important. This makes sure that openvpn does not add
any routes by itself. It will just create a new interface and leave it at that.
Alternatively, you could add `route-noexec` option in the config file.

Also, note the interface name(probably of the form `tunX`) and the IP address of the said interface.
We are going to assume the ip address is `10.8.8.192`.


### Selecting the packets
Now we need to select all the packets from the user `stunnel` to go through the tunnel. iptables conveniently
has a MARK action that, you know, marks them with a number. Hence the rule,
```sh
$ iptables -t mangle -A OUTPUT -m owner --uid-owner stunnel -j MARK --set-mark 0x1
```

### Sending them the right way.
Now that we have the packets, we need to make sure that they go through the tunnel. The following commands do it.
```sh
$ ip rule add from all fwmark 0x1 lookup vpn
$ ip route add default via 10.8.8.192 table vpn
```

The first one ensures that all packets marked with 0x1 (traffic from the `stunnel` user from the last step)
go through the given table 'vpn'. The next adds the rule in the vpn table that makes sure that the packets
go through the given IP. Since the IP is of the VPN interface, `tunX`, all such packets will go through the vpn.

### Making sure they come back.
Now that packets have gone through the VPN interface, we still haven't changed the source IP to that of
the VPN. So packets won't be able to return as of now. Hence, we mask the source IP with that of the interface.
```sh
$ iptables -t nat -I POSTROUTING -o tunX -j MASQUERADE
```

We also need to do this,
```sh
$ sysctl net/ipv4/conf/tunX/rp_filter=2
```
Here we have set reverse path filtering to loose mode. This I believe makes sure that kernel doesn't reject the packet
after the source IP has been unmasked.

### Conclusion and other stuff.
Now, if you, like my university, only allows for a local DNS server, then you still won't be able to resolve hostnames
your `resolv.conf` still points to the local nameservers which you cannot access while using VPN. To get around this,
redirect everything to any public DNS server of your choice. I myself use Google's DNS.
```
$ iptables -t nat -I OUTPUT -p udp --dport 53 -m owner --uid-owner stunnel -j DNAT --to-destination 8.8.8.8:53
```

Finally, if you want to run GUI applications or anything that gives out sound via the *stunnel* user,
you have allow for it. That is a topic for a [separate post]

By now, you have a fully functional split tunnel. To run command with vpn, just go,
```sh
$ sudo -u stunnel -i -- <command>
```

[this]: https://www.htpcguides.com/force-torrent-traffic-vpn-split-tunnel-ubuntu-14-04/
[separate post]: /allow-x-pulse
