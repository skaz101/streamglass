# StreamGlass TV 0.8.2 — Search and keyboard navigation

Search groups titles into Movies, Series, Anime and other supported types, removing duplicate results within each type. Previous artwork remains visible but inactive while a new query loads. The TV screen adds visible Home and Clear controls.

Submitting with Search or the keyboard's Done/Enter action ends editing and moves focus into results when they are ready. After the keyboard closes, Up and Down can leave editing for Home or results. Keyboard visibility changes alone preserve editing for voice input and IME composition; late results do not pull focus away after navigation.

Regression coverage includes submit-to-results focus, keyboard visibility and composition, the Home path, result-to-field navigation, query clearing, and grouped results. The CI browser stage now includes `tests/search-host-browser.cjs`. See the GitHub release for completed CI and physical-TV verification; simulated keyboard events do not establish native LG behavior.

Package ID remains `com.streamglass.tv`. Install over the previous version and keep the corresponding source archive with the installer.
