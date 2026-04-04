with open("static/css/layout.css", "r") as f:
    content = f.read()

search = """#main-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0; /* Important for flex children truncating */
    height: 100dvh;
}"""

replace = """#main-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0; /* Important for flex children truncating */
    height: 100dvh;
    position: relative;
    overflow: hidden;
}"""

content = content.replace(search, replace)

with open("static/css/layout.css", "w") as f:
    f.write(content)
