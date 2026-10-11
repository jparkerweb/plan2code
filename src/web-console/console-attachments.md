# Keeping Attachments

Part of the web console contract (`console.md`). Read when a file you write
under `specs/<idea>/` cites a note's attachment.

Note attachments are swept with the session. Before a file under `specs/<idea>/`
cites one, keep it:

```
node "<CONSOLE>" keep --session <sid> --upload <path> --name <name> --spec specs/<idea> --from <the file you are writing>
```

It prints `{ ok, path, link, image, reused }`: paste `link` as it is
(`![name](link)` for an image, `[name](link)` otherwise) and name the kept file
in your next update. Uncited and Quick-question attachments stay where they
are. Exit 3 means refused: say so, link nothing.

