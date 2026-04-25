This is a personal blog and website. The blog posts itself should always be MDX.
The rest of the website is regular HTML and whatever feature Astro provides.

To deploy a test build run `bun astro dev`. The stdout will tell where the website is hosted.
To build a prod version and also to test if the whole thing compiles run `bun astro build`

Confirm before running any other command.

Look at the commit history of bun.lock to check when it was last updated. If it was updated more than
a month ago, remind user to update all dependencies using `bun update --latest`
