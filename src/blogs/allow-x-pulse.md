---
title: Pulse and X for someone else.
excerpt: Allow GUI and Sound for separate user.
tags: ["snippets"]
comments: true
date: 2017-11-27
---

Both PulseAudio(*audio server*) and X server(*display*) have access controls enabled within it that does not allow anyone other
than the current logged in user to access its services. That means, by default, if you use a separate user (other than *root*)
to start a program, that program will not be able to create a GUI or make a sound.

This may not be ideal in various cases.

## Access control in X
This is pretty straight-forward. The program `xhost` manages the access controls for the server. To allow a user,
```shell-session
$ xhost +si:localuser:<username>
```

Or if you want to open X for all local users,
```shell-session
$ xhost +local:
```


## Access control in PulseAudio
For [security reasons], PulseAudio runs a separate instance for every
user rather than having a single systemwide instance for everyone. There is no simple access controls for PulseAudio.
Hence allowing audio for separate user is more of a workaround. What we do is ask PulseAudio to listen to a specific
local port and we ask the user to send audio to that port.

For the server configuration, edit `/etc/pulse/default.pa` to include the following line:
```shell-session
load-module module-native-protocol-tcp auth-ip-acl=127.0.0.1
```

This makes PulseAudio listen on localhost for audio. Now edit `~/.config/pulse/client.conf` to have the following line
which makes it send audio to localhost
```shell-session
default-server = 127.0.0.1
```


And done. Now you can create UI and send audio as a separate user.

[security reasons]: https://www.freedesktop.org/wiki/Software/PulseAudio/Documentation/User/WhatIsWrongWithSystemWide/
