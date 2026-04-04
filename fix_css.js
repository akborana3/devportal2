<<<<<<< SEARCH
/* --- MAIN CONTENT & TOPBAR --- */
#main-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0; /* Important for flex children truncating */
    height: 100dvh;
}
=======
/* --- MAIN CONTENT & TOPBAR --- */
#main-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0; /* Important for flex children truncating */
    height: 100dvh;
    position: relative; /* Add this to allow absolute positioning of views */
    overflow: hidden; /* Prevent scrolling of the whole main content area */
}
>>>>>>> REPLACE
<<<<<<< SEARCH
        /* Smooth transitions for views */
        .view-container {
            opacity: 0;
            transition: opacity 0.3s ease-in-out;
        }
        .view-container.active {
            opacity: 1;
        }
=======
        /* Smooth transitions for views */
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
        }
>>>>>>> REPLACE
