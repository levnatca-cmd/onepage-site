# Saved website export

[LEVNAT website snapshot, November 6, 2026](levnat-website-2026-11-06.zip) contains the source and prebuilt site from the original export. The current website is served from the repository root with `npm run dev` on port 4173.

To preview the saved version, extract it into a temporary folder and start its server.

```sh
archive_dir=$(mktemp -d)
unzip -q artifacts/archives/website/levnat-website-2026-11-06.zip -d "$archive_dir"
cd "$archive_dir/levnat-website"
PORT=4176 node scripts/serve.mjs
```

Open http://127.0.0.1:4176/. The extracted `START-HERE.md` has rebuild instructions.
