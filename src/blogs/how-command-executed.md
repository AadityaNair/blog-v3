---
title: Looking at you, shell
excerpt: A view into how shell executes commands, via system calls.
tags: ["linux"]
comments: true
date: 2017-10-18
---

So, the other day I decided to look around how a shell (like `zsh`) goes about executing commands. This time I had my
`strace` tool in hand, so I could snoop around what syscalls the shell makes while executing a command.

*Note*: This is basically me looking at [this] stack-overflow answer and drawing conclusions.

This the setup command I used.
```shell-session
$ cat | strace -f bash > /dev/null
```
Let's look at this for a second, here. There are three parts to this command.
1. `cat |`. *cat* without arguments just echoes back whatever we write on the terminal. That means, whatever we write, we pass to
the command at the other end of the pipe `strace` as a whole. We will come to why we need this in a moment.
2. `strace -f bash`. This is simple, we just trace the bash process. The `-f` flag makes sure that all the processes created by
bash is also traced as well.
3. `> /dev/null`. We want to make sure that our screen is not clogged by the outputs of the command we run in addition to the
strace output. Hence we make sure that the output of bash is sent to null.

## What I found
It starts off pretty much the same way all programs do
```bash
execve("/usr/bin/bash", ["bash"], 0x7ffddebf9828 /* 71 vars */) = 0
brk(NULL)                               = 0x55b142ab9000
mmap(NULL, 8192, PROT_READ|PROT_WRITE, MAP_PRIVATE|MAP_ANONYMOUS, -1, 0) = 0x7fdeb00bf000
access("/etc/ld.so.preload", R_OK)      = -1 ENOENT (No such file or directory)
open("/etc/ld.so.cache", O_RDONLY|O_CLOEXEC) = 3
fstat(3, {st_mode=S_IFREG|0644, st_size=108704, ...}) = 0
mmap(NULL, 108704, PROT_READ, MAP_PRIVATE, 3, 0) = 0x7fdeb00a4000
close(3)                                = 0
open("/lib64/libtinfo.so.6", O_RDONLY|O_CLOEXEC) = 3
.
.
.
fcntl(0, F_GETFL)                       = 0 (flags O_RDONLY)
fstat(0, {st_mode=S_IFIFO|0600, st_size=0, ...}) = 0
lseek(0, 0, SEEK_CUR)                   = -1 ESPIPE (Illegal seek)
read(0,
```

Quite interestingly, the output shows it blocking  at the middle of the `read` syscall. Probably that is how *strace*
shows stuff.

###  Reading a command.

```bash
read(0, cd
"c", 1)                         = 1
read(0, "d", 1)                         = 1
read(0, "\n", 1)                        = 1
.
.
.
```
What's this? So, the shell reads commands one character at a time and not as a whole. This is exactly why we piped `cat` into
it. Otherwise, it would read every character we entered exactly when we entered it, making the flow difficult to understand.

### Executing a shell builting
This part is pretty simple. Once it detects a *builtin*, it just executes it without further ado.
```bash
read(0, cd
"c", 1)                         = 1
read(0, "d", 1)                         = 1
read(0, "\n", 1)                        = 1
stat("/home", {st_mode=S_IFDIR|0755, st_size=56, ...}) = 0
stat("/home/Aaditya", {st_mode=S_IFDIR|0700, st_size=4096, ...}) = 0
chdir("/home/Aaditya")                  = 0
read(0,
```

### Executing any other command
This is much more interesting, we can actually see the shell going through the `PATH` variable looking for the command.
```bash
read(0, ls
"l", 1)                         = 1
read(0, "s", 1)                         = 1
read(0, "\n", 1)                        = 1
stat(".", {st_mode=S_IFDIR|0700, st_size=4096, ...}) = 0
stat("/usr/local/bin/ls", 0x7ffc7ef731f0) = -1 ENOENT (No such file or directory)
stat("/usr/local/sbin/ls", 0x7ffc7ef731f0) = -1 ENOENT (No such file or directory)
stat("/usr/bin/ls", {st_mode=S_IFREG|0755, st_size=133096, ...}) = 0
stat("/usr/bin/ls", {st_mode=S_IFREG|0755, st_size=133096, ...}) = 0
geteuid()                               = 1123
getegid()                               = 1123
getuid()                                = 1123
getgid()                                = 1123
access("/usr/bin/ls", X_OK)             = 0
stat("/usr/bin/ls", {st_mode=S_IFREG|0755, st_size=133096, ...}) = 0
.
.
.
rt_sigprocmask(SIG_BLOCK, [INT CHLD], [], 8) = 0
clone(child_stack=NULL, flags=CLONE_CHILD_CLEARTID|CLONE_CHILD_SETTID|SIGCHLD, child_tidptr=0x7f52a8a35e10) = 728
strace: Process 728 attached
[pid 32630] rt_sigprocmask(SIG_SETMASK, [], NULL, 8) = 0
[pid   728] getpid()                    = 728
.
.
.
```
I have removed a lot of output for brevity's sake but you get the gist of what's going on.
Once shell reads the input and recognizes that it is not a builtin, it goes looking through the `PATH` environment variable
for the executable, **in order**. Once it finds it, it goes on with creating a child process for the executable and the usual process
follows.

### Executing a non existent command
Another interesting thing happens when the command is not found.
```bash
read(0, some_random_command
"s", 1)                         = 1
read(0, "o", 1)                         = 1
read(0, "m", 1)                         = 1
.
.
.
stat("/usr/local/bin/some_random_command", 0x7ffc7ef731f0) = -1 ENOENT (No such file or directory)
stat("/usr/local/sbin/some_random_command", 0x7ffc7ef731f0) = -1 ENOENT (No such file or directory)
stat("/usr/bin/some_random_command", 0x7ffc7ef731f0) = -1 ENOENT (No such file or directory)
stat("/usr/sbin/some_random_command", 0x7ffc7ef731f0) = -1 ENOENT (No such file or directory)
rt_sigprocmask(SIG_BLOCK, [INT CHLD], [], 8) = 0
clone(child_stack=NULL, flags=CLONE_CHILD_CLEARTID|CLONE_CHILD_SETTID|SIGCHLD, child_tidptr=0x7f52a8a35e10) = 18389
strace: Process 18389 attached
.
.
.
[pid 18389] fstat(2, {st_mode=S_IFCHR|0620, st_rdev=makedev(136, 7), ...}) = 0
[pid 18389] write(2, "bash: line 24: some_random_comma"..., 54bash: line 24: some_random_command: command not found
) = 54
[pid 18389] exit_group(127)             = ?
[pid 18389] +++ exited with 127 +++
```
The shell still creates a new process to inform you that the command does not exists.

## Conclusion
This is a pretty simplistic view of the shell on the basis of how it interacts with the kernel. This however does not show
what logic that it internally uses. We need some different methods to analyze that.

[this]: https://unix.stackexchange.com/questions/90711/is-it-possible-to-strace-the-builtin-commands-to-bash
