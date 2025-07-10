import * as vscode from 'vscode';
import { getWikiLinkAt } from './WikiLinksRef';
import { WikiLinksWorkspace } from './WikiLinksWorkspace';

export class WikiLinksReferenceProvider implements vscode.ReferenceProvider {
  public async provideReferences(
    document: vscode.TextDocument,
    position: vscode.Position,
    _context: vscode.ReferenceContext,
    _token: vscode.CancellationToken
  ): Promise<vscode.Location[]> {
    const ref = getWikiLinkAt(document, position);
    if (!ref || ref.type !== 'WikiLink') {
      return [];
    }

    // Search for all occurrences of this wiki-link in the workspace
    const files = await WikiLinksWorkspace.noteFiles();
    const locations: vscode.Location[] = [];

    for (const file of files) {
      try {
        const content = await vscode.workspace.fs.readFile(file);
        const text = content.toString();
        const lines = text.split('\n');

        for (let lineNum = 0; lineNum < lines.length; lineNum++) {
          const line = lines[lineNum];
          if (!line) continue;
          const wikiLinkRegex = WikiLinksWorkspace.rxWikiLink();
          let match;

          while ((match = wikiLinkRegex.exec(line)) !== null) {
            const wikiLinkText = match[0].slice(2, -2); // Remove [[ and ]]
            if (WikiLinksWorkspace.noteNamesFuzzyMatchText(wikiLinkText, ref.word)) {
              const startPos = new vscode.Position(lineNum, match.index);
              const endPos = new vscode.Position(lineNum, match.index + match[0].length);
              const range = new vscode.Range(startPos, endPos);
              locations.push(new vscode.Location(file, range));
            }
          }
        }
      } catch (_error) {
        // Ignore errors when reading files
      }
    }

    return locations;
  }
} 