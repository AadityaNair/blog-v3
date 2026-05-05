This is a personal blog and website. The blog posts itself should always be MDX.
The rest of the website is regular HTML and whatever feature Astro provides.

You can generally expect `bun astro dev` to be running on the background. This is supposed to be the dev environment
and it autoloads all the changes (unless you broke the build in some way).
The default URL for this is `localhost:4321/`

To check if the website builds itself properly, run `bun astro build` and look at the output.

Look at the commit history of bun.lock to check when it was last updated. If it was updated more than
a month ago, remind user to update all dependencies using `bun update --latest`
Confirm before running any other command.
