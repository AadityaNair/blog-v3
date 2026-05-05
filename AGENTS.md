This is a personal blog and website. The blog posts itself should always be MDX.
The rest of the website is regular HTML and whatever feature Astro provides.

You can generally expect `bun astro dev` to be running on the background. This is supposed to be the dev environment
and it autoloads all the changes (unless you broke the build in some way).
The default URL for this is `localhost:4321/`

To check if the website builds itself properly, run `bun astro build` and look at the output.

Always use tailwind utility classes instead of actual CSS wherever possible.
Also, ideally avoid specifying exact sizes where possible and use standard tailwind sizes like xl, 2xl, etc.

Always ensure that any changes made also work for mobile. Content should look weird/overflowed in mobile.
Similarly, any colours we choose should work in both dark and light mode. The colour doesn't need to be the same.

We should commit every reasonably sized feature before moving on. So, during conversation if we move from one feature
to the next, commit the changes before moving on. Provide proper title and full description of the change.
