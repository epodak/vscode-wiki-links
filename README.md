# Wiki Links for VS Code

Navigate notes with `[[wiki-links]]` and auto-completion. Automatically create notes from new inline `[[wiki-links]]`.

## Features

### Wiki Links (`[[wiki-links]]`)

- **Syntax highlighting** for wiki-links
- **Auto-completion** for existing notes
- **Go to Definition** (`Ctrl+Click` or `F12`) to navigate to linked notes
- **Peek Definition** (`Alt+F12`) to preview linked notes
- **Find All References** (`Shift+F12`) to find all occurrences of a wiki-link
- **Auto-create notes** when navigating to non-existent wiki-links



## Usage

1. **Create wiki-links**: Type `[[` and start typing to get auto-completion
2. **Navigate**: `Ctrl+Click` on a wiki-link to go to the note
3. **Create new notes**: When navigating to a non-existent note, it will be created automatically
4. **Find references**: `Shift+F12` on a wiki-link to find all occurrences

## Configuration

- `vscodeWikiLinks.workspaceFilenameConvention`: How to handle filenames (`uniqueFilenames` or `relativePaths`)
- `vscodeWikiLinks.createNoteOnGoToDefinitionWhenMissing`: Auto-create missing notes
- `vscodeWikiLinks.triggerSuggestOnReplacement`: Trigger suggestions when replacing text in wiki-links

## Development

```bash
npm install
npm run compile
```

Press `F5` in VS Code to run the extension in a new Extension Development Host window. 