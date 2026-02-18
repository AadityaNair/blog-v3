---
title: List all commands in any man section
excerpt: A fun way to discover new commands
tags: ["snippets", "linux"]
comments: true
date: 2016-08-21
---

So you know that all the _manual pages_ as grouped by sections based on what they do. So what do you do when
you want to list all commands at a given section? you tune the `apropos` command as follows:

~~~ shell
apropos --wildcard "*" --section <section_number>
~~~

One general knowledge question you can answer is this:
> Find how many system calls are supported in linux, at the moment.

The manuals for all system calls are grouped in section 2. The answer becomes quite simple now.
~~~shell
$ apropos --wildcard "*" --section 2 | wc -l
471
~~~
