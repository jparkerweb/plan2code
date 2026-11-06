# Keeping Attachments

Read when a file you write under `specs/<idea>/` cites a note's attachment. Attachments are swept with the session, so keep one first:

`node "<CONSOLE>" keep --session <sid> --upload <path> --name <name> --spec specs/<idea> --from <the file you are writing>`

It prints `{ok,path,link,image,reused}`: paste `link` as given (`![name](link)` for an image, `[name](link)` otherwise) and name the kept file in your next update. Uncited and Quick-question attachments stay where they are. Exit 3 means refused: say so and link nothing.
