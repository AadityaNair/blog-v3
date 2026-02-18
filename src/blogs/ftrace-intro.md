---
title: FTrace - The OG Kernel Tracer
excerpt: A fun way to discover new commands
tags: ["kernel", "linux"]
comments: true
date: 2021-07-09
---

FTrace is probably the first tracing system implemented for the Linux Kernel. Ftrace allows you to trace function calls within the
kernel. It is a very fun tool learn about certain parts of the kernel. While it might not be the best tool to debug any bugs in the kernel (you will see why), it is nonetheless a valuable tool
to start the debugging process with.

## Getting Started

You don't really need any special tool to start tracing. Just having the `cat` and `echo` commands is enough!!
All of FTrace and its related utilities are found in the `/sys/kernel/tracing/` folder or the `/sys/kernel/debug/tracing` folder.
This a special filesystem managed by the kernel much like the `/proc/` folder.
```shell
$ ls /sys/kernel/tracing
events                      buffer_size_kb            kprobe_events          set_event_pid           stack_trace_filter  tracing_max_latency
hwlat_detector              buffer_total_size_kb      kprobe_profile         set_ftrace_filter       synthetic_events    tracing_on
instances                   current_tracer            max_graph_depth        set_ftrace_notrace      timestamp_mode      tracing_thresh
options                     dynamic_events            printk_formats         set_ftrace_notrace_pid  trace               uprobe_events
per_cpu                     dyn_ftrace_total_info     README                 set_ftrace_pid          trace_clock         uprobe_profile
trace_stat                  enabled_functions         saved_cmdlines         set_graph_function      trace_marker
available_events            error_log                 saved_cmdlines_size    set_graph_notrace       trace_marker_raw
available_filter_functions  eval_map                  saved_tgids            snapshot                trace_options
available_tracers           free_buffer               set_event              stack_max_size          trace_pipe
buffer_percent              function_profile_enabled  set_event_notrace_pid  stack_trace             tracing_cpumask
```
Point to note, you will **need** to be root perform these actions.

## Start Tracing

FTrace can be used to trace multiple different things like function calls, I/O events, latency, etc. Each one of them is a separate
"tracer" within FTrace. The default tracer is a _nop_ tracer which is a placeholder for "don't trace anything".

The standard workflow is to set a tracer in the `current_tracer` file. Doing this enables that particular tracer. The tracing data can

then be read off the `trace` file.
Start by tracing all functions,
```shell
$ echo function > current_tracer
$ cat trace
# tracer: function
#
# entries-in-buffer/entries-written: 512466/33530561   #P:8
#
#                                _-----=> irqs-off
#                               / _----=> need-resched
#                              | / _---=> hardirq/softirq
#                              || / _--=> preempt-depth
#                              ||| /     delay
#           TASK-PID     CPU#  ||||   TIMESTAMP  FUNCTION
#              | |         |   ||||      |         |
    tmux: server-5640    [006] .... 94728.985691: page_remove_rmap <-wp_page_copy
    tmux: server-5640    [006] .... 94728.985691: lock_page_memcg <-page_remove_rmap
    tmux: server-5640    [006] .... 94728.985691: __mod_lruvec_page_state <-page_remove_rmap
    tmux: server-5640    [006] .... 94728.985691: __mod_lruvec_state <-page_remove_rmap
    tmux: server-5640    [006] .... 94728.985691: __mod_node_page_state <-__mod_lruvec_state
    tmux: server-5640    [006] .... 94728.985691: __mod_memcg_lruvec_state <-page_remove_rmap
    tmux: server-5640    [006] .... 94728.985691: __mod_memcg_state.part.0 <-__mod_memcg_lruvec_state
    tmux: server-5640    [006] .... 94728.985691: unlock_page_memcg <-wp_page_copy
    tmux: server-5640    [006] .... 94728.985691: rcu_read_unlock_strict <-wp_page_copy
    tmux: server-5640    [006] .... 94728.985691: up_read <-do_user_addr_fault
<lot more data>
```

You can find all the different tracers that are available to you in, you guessed it, the `available_tracers` file.
```shell
$ cat available_tracers
hwlat blk mmiotrace function_graph wakeup_dl wakeup_rt wakeup function nop
```

### Pretty Tracing
The above function trace is pretty hard to read on its own. It would be nice to see the call stack (?) in a better indented way.
That's exactly what the `function_graph` tracer does:
```shell
$ echo function_graph > current_tracer
$ cat trace
4)               |      tty_poll() {
4)               |        tty_ldisc_ref_wait() {
4)               |          ldsem_down_read() {
4)               |            __cond_resched() {
4)   0.092 us    |              rcu_all_qs();
4)   0.272 us    |            }
4)   0.456 us    |          }
4)   0.677 us    |        }
4)               |        n_tty_poll() {
4)               |          tty_buffer_flush_work() {
4)               |            flush_work() {
4)               |              start_flush_work.constprop.0() {
4)               |                __cond_resched() {
4)   0.091 us    |                  rcu_all_qs();
4)   0.271 us    |                }
4)   0.109 us    |                _raw_spin_lock_irq();
4)   0.095 us    |                rcu_read_unlock_strict();
4)   0.842 us    |              }
4)   1.021 us    |            }
4)   1.211 us    |          }

```
The problem here is that you don't see the process information or the other irq/sched flags.

## Filtering Results
Ftrace comes with its set of filtering capabilites that make life easier.
* `max_graph_depth` sets how far inside the call stack Ftrace will go to. (only for function_graph)
* `set_ftrace_pid` only traces functions called by a particular set of PIDs (doesn't work with function_graph).
* If you want to trace only specific functions, you can use `set_ftrace_filter` and `set_ftrace_notrace`. Both of them support wildcards
so you can use it to ignore a set of functions or functions from a particular submodule.

## Tracepoints
Tracepoints correspond to important events happening within the kernel. Some of these events may coincide with some other kernel functions
(like a syscall being called) while others might now (like context switches or TLB flushes). FTrace can trace those too!! and it provides
a lot more information than tracing plain kernel functions.

To look at all events:
```shell
$ cat available_events
alarmtimer:alarmtimer_cancel
alarmtimer:alarmtimer_fired
alarmtimer:alarmtimer_start
alarmtimer:alarmtimer_suspend
avc:selinux_audited
block:block_bio_backmerge
block:block_bio_bounce
...
```
Or the events folder for a more organized (grouped by the subsystems these events happen in):
```shell
$ ls events/
alarmtimer/    context_tracking/  fs_dax/          intel_iommu/   kvmmmu/     msr/             printk/
avc/           cpuhp/             ftrace/          interconnect/  kyber/      napi/            pwm/
...
```

Enabling events is slightly different than other tracers. You don't write to the current_tracer file.
```shell
## To enable a single event
$ echo 'sched:sched_switch' > set_event
## Or
$ echo 1 > events/sched/sched_switch

## Or to enable a class of events
$ echo 'sched:*' > set_event
## Or,
$ echo 1 > events/sched/enable
```

The information you get with that is astounding:
```
$ cat trace
# tracer: nop
#
# entries-in-buffer/entries-written: 139625/1148940   #P:8
#
#                                _-----=> irqs-off
#                               / _----=> need-resched
#                              | / _---=> hardirq/softirq
#                              || / _--=> preempt-depth
#                              ||| /     delay
#           TASK-PID     CPU#  ||||   TIMESTAMP  FUNCTION
#              | |         |   ||||      |         |
   kworker/u16:3-232496  [002] d... 187033.704526: sched_switch: prev_comm=kworker/u16:3 prev_pid=232496 prev_prio=120 prev_state=I ==> next_comm=swapper/2 next_pid=0 next_prio=120
           kitty-3095    [006] d... 187033.704527: sched_switch: prev_comm=kitty prev_pid=3095 prev_prio=120 prev_state=S ==> next_comm=swapper/6 next_pid=0 next_prio=120
```
Here too, you can limit to events from certain PIDs via the `set_event_pid` file. But with events, you also have the power to filter
on any of the variables returned by them.
```shell
$ echo 'prev_comm=="kitty"' > events/sched/sched_switch/filter
$ echo 1 > events/sched/sched_switch/enable
$ cat trace
# tracer: nop
#
# entries-in-buffer/entries-written: 135/135   #P:8
#
#                                _-----=> irqs-off
#                               / _----=> need-resched
#                              | / _---=> hardirq/softirq
#                              || / _--=> preempt-depth
#                              ||| /     delay
#           TASK-PID     CPU#  ||||   TIMESTAMP  FUNCTION
#              | |         |   ||||      |         |
           kitty-3095    [003] d... 238164.074632: sched_switch: prev_comm=kitty prev_pid=3095 prev_prio=120 prev_state=S ==> next_comm=swapper/3 next_pid=0 next_prio=120
           kitty-3095    [003] d... 238164.074662: sched_switch: prev_comm=kitty prev_pid=3095 prev_prio=120 prev_state=S ==> next_comm=swapper/3 next_pid=0 next_prio=120
           kitty-3095    [003] d... 238164.075418: sched_switch: prev_comm=kitty prev_pid=3095 prev_prio=120 prev_state=S ==> next_comm=swapper/3 next_pid=0 next_prio=120
...
```
## One tool to rule them all?
`trace-cmd` and `kernelshark` are tools written by the authors of FTrace to simplify things for users. `trace-cmd` allows you to
not remember all the files and formats and smooths over any differences between kernel versions or distribution specific details.
You can also record a trace and look through it anytime in the future. `kernelshark` does the same but with a GUI.

```shell
# List all events
$ trace-cmd list -e

# Trace a particular PID
$ trace-cmd record -p function_graph --max-graph-depth 4 -P 4152

# Trace all functions with 'send' in its name. But ignore all functions that contain 'lock'
$ trace-cmd record -p function -g "*send*" -n '*lock*'

# View the recorded data
$ trace-cmd report
```
There are a lot more examples of usage. I recommend reading through its man page.
## A practical example
Suppose you want to figure out what happens when you `ping` a host on the kernel level. You can trace the execution as



1. To get to the which kernel level function is called, start with `strace`

```shell
strace ping -c 1 8.8.8.8
[...]
sendto(3, "\10\0C0\0\0\0\1x\261\345`\0\0\0\0\212\351\r\0\0\0\0\0\20\21\22\23\24\25\26\27"..., 64, 0, {sa_family=AF_INET, sin_port=htons(0), sin_addr=inet_addr("1.1.1.1")}, 16) = 64
[...]
recvmsg(3, {msg_name={sa_family=AF_INET, sin_port=htons(0), sin_addr=inet_addr("1.1.1.1")}, msg_namelen=128 => 16, msg_iov=[{iov_base="\0\0K*\0\6\0\1x\261\345`\0\0\0\0\212\351\r\0\0\0\0\0\20\21\22\23\24\25\26\27"..., iov_len=192}], msg_iovlen=1, msg_control=[{cmsg_len=32, cmsg_level=SOL_SOCKET, cmsg_type=SO_TIMESTAMP_OLD, cmsg_data={tv_sec=1625665912, tv_usec=948438}}, {cmsg_len=20, cmsg_level=SOL_IP, cmsg_type=IP_TTL, cmsg_data=[53]}], msg_controllen=56, msg_flags=0}, 0) = 64
[...]
```
Among the sea of syscalls, you can see the two syscalls directly responsible for sending are receiving packets.
These functions we will trace with ftrace.


2. Let's look at `sendto(2)` for example. You can find out what functions `sendto` corresponds to within the kernel. Or you can just
trace everything with substring `sendto`.
```shell
$ trace-cmd list -f | grep -i sendto
__sys_sendto
__x64_sys_sendto
__ia32_sys_sendto
__traceiter_rpc_xdr_sendto [sunrpc]
__traceiter_svc_xdr_sendto [sunrpc]
svc_udp_sendto [sunrpc]
svc_tcp_sendto [sunrpc]
```
At this point, it looks like it should be either `__sys_sendto` or `__x64_sys_sendto` functions.


3. Now we can run ftrace on this command and look for the above two functions.
```shell
$ trace-cmd record -p function_graph --max-graph-depth 4 -g "__sys_sendto" -g "__x64_sys_sendto" -o ping.dat ping -c1 8.8.8.8
# OR
$ trace-cmd record -p function_graph --max-graph-depth 4 -g "*sendto*" -o ping.dat ping -c1 8.8.8.8
[output omitted]

$ trace-cmd report -i ping.dat
CPU 1 is empty
CPU 3 is empty
CPU 4 is empty
CPU 5 is empty
CPU 6 is empty
CPU 7 is empty
cpus=8
 Chrome_ChildIOT-316857 [000] 264392.613796: funcgraph_entry:        0.856 us   |  __switch_to_xtra();
            ping-327643 [002] 264392.614202: funcgraph_entry:                   |  __x64_sys_sendto() {
            ping-327643 [002] 264392.614203: funcgraph_entry:                   |    __sys_sendto() {
            ping-327643 [002] 264392.614203: funcgraph_entry:                   |      sockfd_lookup_light() {
            ping-327643 [002] 264392.614203: funcgraph_entry:                   |        __fdget() {
            ping-327643 [002] 264392.614203: funcgraph_entry:        0.118 us   |          __fget_light();
            ping-327643 [002] 264392.614204: funcgraph_exit:         0.367 us   |        }
            ping-327643 [002] 264392.614204: funcgraph_exit:         0.554 us   |      }
            ping-327643 [002] 264392.614204: funcgraph_entry:                   |      move_addr_to_kernel.part.0() {
            ping-327643 [002] 264392.614204: funcgraph_entry:                   |        __check_object_size() {
            ping-327643 [002] 264392.614204: funcgraph_entry:        0.103 us   |          check_stack_object();
            ping-327643 [002] 264392.614204: funcgraph_exit:         0.290 us   |        }
            ping-327643 [002] 264392.614204: funcgraph_exit:         0.533 us   |      }
            ping-327643 [002] 264392.614204: funcgraph_entry:                   |      sock_sendmsg() {
            ping-327643 [002] 264392.614204: funcgraph_entry:                   |        security_socket_sendmsg() {
            ping-327643 [002] 264392.614205: funcgraph_entry:                   |          selinux_socket_sendmsg() {
            ping-327643 [002] 264392.614205: funcgraph_entry:        0.203 us   |            avc_has_perm();
            ping-327643 [002] 264392.614205: funcgraph_exit:         0.396 us   |          }
            ping-327643 [002] 264392.614205: funcgraph_entry:        0.102 us   |          bpf_lsm_socket_sendmsg();
            ping-327643 [002] 264392.614205: funcgraph_exit:         0.867 us   |        }
            ping-327643 [002] 264392.614205: funcgraph_entry:                   |        inet_sendmsg() {
            ping-327643 [002] 264392.614206: funcgraph_entry:                   |          inet_send_prepare() {
            ping-327643 [002] 264392.614206: funcgraph_entry:        1.046 us   |            inet_autobind();
            ping-327643 [002] 264392.614207: funcgraph_exit:         1.281 us   |          }
            ping-327643 [002] 264392.614207: funcgraph_entry:                   |          ping_v4_sendmsg() {
            ping-327643 [002] 264392.614207: funcgraph_entry:        0.421 us   |            ping_common_sendmsg();
            ping-327643 [002] 264392.614208: funcgraph_entry:        0.102 us   |            rcu_read_unlock_strict();
            ping-327643 [002] 264392.614208: funcgraph_entry:        0.270 us   |            security_sk_classify_flow();
            ping-327643 [002] 264392.614208: funcgraph_entry:        0.996 us   |            ip_route_output_flow();
            ping-327643 [002] 264392.614210: funcgraph_entry:        0.256 us   |            lock_sock_nested();
            ping-327643 [002] 264392.614210: funcgraph_entry:        2.677 us   |            ip_append_data();
            ping-327643 [002] 264392.614213: funcgraph_entry:        0.176 us   |            csum_partial();
            ping-327643 [002] 264392.614213: funcgraph_entry:      + 53.491 us  |            ip_push_pending_frames();
            ping-327643 [002] 264392.614267: funcgraph_entry:        0.359 us   |            release_sock();
            ping-327643 [002] 264392.614267: funcgraph_entry:        0.102 us   |            dst_release();
            ping-327643 [002] 264392.614283: funcgraph_entry:        0.231 us   |            icmp_out_count();
            ping-327643 [002] 264392.614283: funcgraph_exit:       + 76.091 us  |          }
            ping-327643 [002] 264392.614283: funcgraph_exit:       + 77.835 us  |        }
            ping-327643 [002] 264392.614283: funcgraph_exit:       + 79.055 us  |      }
            ping-327643 [002] 264392.614284: funcgraph_exit:       + 80.691 us  |    }
            ping-327643 [002] 264392.614284: funcgraph_exit:       + 81.531 us  |  }
```
Can't say why we are getting Chrome's calls in the trace. Looking at trace-cmd's actions, it seems like my version doesn't write to
`set_ftrace_pid` correctly. Maybe my version has a bug or maybe it just isn't possible for trace-cmd to  figure out ping's PID.
Either way, we have our trace.

Looking at the trace, it seems like `ping_v4_sendmsg` does the most interesting work. You can find that function by grepping
through the linux's code. The function's definition is [here].

## Conclusions and further reading
FTrace is a pretty sweet tool for kernel introspection. The timing information you get with this is quite useful to debug
performance issues in the kernel. However, it has some disadvantages if used as a whole debugging tool, the biggest one
being that **you don't get function arguments**.

If you want to read more look at [this tutorial] by Steven Rostedt. This post is basically a TL;DR of that.\
If you are interested in some internals of FTrace have a look at [this talk] from the same guy.

[here]: https://github.com/torvalds/linux/blob/v5.13/net/ipv4/ping.c#L685
[this tutorial]: https://www.youtube.com/watch?v=68osT1soAPM
[this talk]: https://www.youtube.com/watch?v=93uE_kWWQjs
