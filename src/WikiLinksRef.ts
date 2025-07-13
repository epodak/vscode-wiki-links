import * as vscode from 'vscode';
import { WikiLinksWorkspace } from './WikiLinksWorkspace';

export interface WikiLinkRef {
  type: 'WikiLink' | 'Null';
  word: string;
  range: vscode.Range | undefined;
}

export const NULL_WIKI_LINK_REF: WikiLinkRef = {
  type: 'Null',
  word: '',
  range: undefined,
};

export function getWikiLinkAt(document: vscode.TextDocument, position: vscode.Position): WikiLinkRef | null {
  let ref: string;
  const regex: RegExp = WikiLinksWorkspace.rxWikiLink();
  
  // Get the line text and find all wiki-link matches
  const line = document.lineAt(position.line).text;
  let match;
  
  while ((match = regex.exec(line)) !== null) {
    const matchStart = match.index;
    const matchEnd = match.index + match[0].length;
    
    // Check if the cursor position is within this match
    if (position.character >= matchStart && position.character <= matchEnd) {
      // Our rxWikiLink contains [[ and ]] chars
      // but the replacement words do NOT.
      // So, account for the (exactly) 2 [[  chars at beginning of the match
      // since our replacement words do not contain [[ chars
      const s = new vscode.Position(position.line, matchStart + 2);
      // And, account for the (exactly) 2 ]]  chars at beginning of the match
      // since our replacement words do not contain ]] chars
      const e = new vscode.Position(position.line, matchEnd - 2);
      // keep the end
      const r = new vscode.Range(s, e);
      ref = document.getText(r);
      if (ref) {
        return {
          type: 'WikiLink',
          word: ref,
          range: r,
        };
      }
    }
  }

  return null;
}

export function getEmptyWikiLinkAt(document: vscode.TextDocument, position: vscode.Position): WikiLinkRef {
  // Handle the case where we have the cursor directly after [[ chars with NO letters after the [[
  const c = Math.max(0, position.character - 2); // 2 chars left, unless we are at the 0 or 1 char
  const s = new vscode.Position(position.line, c);
  const searchRange = new vscode.Range(s, position);
  const precedingChars = document.getText(searchRange);

  if (precedingChars === '[[') {
    return {
      type: 'WikiLink',
      word: '', // just use empty string
      // we DO NOT want the replacement position to include the brackets:
      range: new vscode.Range(position, position),
    };
  }

  return NULL_WIKI_LINK_REF;
}

export function getWikiLinkOrEmptyAt(document: vscode.TextDocument, position: vscode.Position): WikiLinkRef {
  let ref = getWikiLinkAt(document, position);
  if (!ref) {
    ref = getEmptyWikiLinkAt(document, position);
  }
  return ref;
} 