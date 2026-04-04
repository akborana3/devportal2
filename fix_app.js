<<<<<<< SEARCH
        // Close mobile sidebar
        // Load projects if switching to projects view
        if (viewId === 'projects-view') loadPublishedProjects();
        if (viewId === 'ai-chat-view') loadAIChatHistory();
        if (viewId === 'apps-view') checkGithubStatus();

        if(window.innerWidth <= 768) {
             document.getElementById('sidebar').classList.remove('open');
        }
    }
}
=======
        // Load projects if switching to projects view
        if (viewId === 'projects-view') loadPublishedProjects();
        if (viewId === 'ai-chat-view') loadAIChatHistory();
        if (viewId === 'apps-view') checkGithubStatus();

        // Close mobile sidebar
        if(window.innerWidth <= 768) {
             document.getElementById('sidebar').classList.remove('open');
        }
    }
}
>>>>>>> REPLACE
