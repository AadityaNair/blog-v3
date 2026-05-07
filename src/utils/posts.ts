import { getCollection } from "astro:content";

export async function getSortedPosts() {
  return (await getCollection("blogs")).sort(
    (a, b) => b.data.date.getTime() - a.data.date.getTime()
  );
}
