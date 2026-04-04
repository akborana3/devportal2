with open("templates/index.html", "r") as f:
    content = f.read()

search = """        /* Smooth transitions for views */
        .view-container {
            opacity: 0;
            transition: opacity 0.3s ease-in-out;
        }
        .view-container.active {
            opacity: 1;
        }"""

replace = """        /* Smooth transitions for views */
        .view-container {
            display: none;
            opacity: 0;
            transition: opacity 0.3s ease-in-out;
            position: absolute;
            top: 40px; /* height of top-bar */
            left: 0;
            right: 0;
            bottom: 0;
            overflow-y: auto; /* Allow scrolling within the view */
        }
        .view-container.active {
            display: block;
            opacity: 1;
            z-index: 10;
        }

        #terminal-view.view-container {
             display: none; /* Reset display to default */
        }
        #terminal-view.view-container.active {
             display: flex; /* Terminal needs flex layout */
        }

        #editor-view.view-container {
            display: none;
        }
        #editor-view.view-container.active {
            display: flex; /* Editor layout is flex */
        }"""

content = content.replace(search, replace)

with open("templates/index.html", "w") as f:
    f.write(content)
