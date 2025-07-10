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

### Commands

- **Wiki Links: New Note** - Create a new note with a custom name
- **Wiki Links: New Note From Selection** - Create a new note from selected text and replace the selection with a wiki-link

## Usage

1. **Create wiki-links**: Type `[[` and start typing to get auto-completion
2. **Navigate**: `Ctrl+Click` on a wiki-link to go to the note
3. **Create new notes**: When navigating to a non-existent note, it will be created automatically
4. **Find references**: `Shift+F12` on a wiki-link to find all occurrences

## Configuration

- `vscodeWikiLinks.workspaceFilenameConvention`: How to handle filenames (`uniqueFilenames` or `relativePaths`)
- `vscodeWikiLinks.createNoteOnGoToDefinitionWhenMissing`: Auto-create missing notes
- `vscodeWikiLinks.newNoteDirectory`: Directory for new notes (`SAME_AS_ACTIVE_NOTE`, `WORKSPACE_ROOT`, or custom path)
- `vscodeWikiLinks.newNoteTemplate`: Template for new notes (supports `${noteName}` and `${timestamp}` tokens)
- `vscodeWikiLinks.newNoteFromSelectionReplacementTemplate`: Template for replacing selected text (supports `${wikiLink}` and `${noteName}` tokens)
- `vscodeWikiLinks.lowercaseNewNoteFilenames`: Convert new note filenames to lowercase
- `vscodeWikiLinks.triggerSuggestOnReplacement`: Trigger suggestions when replacing text in wiki-links

## Development

```bash
npm install
npm run compile
```

Press `F5` in VS Code to run the extension in a new Extension Development Host window. 