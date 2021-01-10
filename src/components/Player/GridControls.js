import './css/gridControls.css';

import React, {Component} from 'react';

import GridObject from '../../lib/wrappers/GridWrapper';
import {keybinds, vimModes} from '../Game/Game';

function safe_while(condition, step, cap = 500) {
  while (condition() && cap >= 0) {
    step();
    cap -= 1;
  }
}

export default class GridControls extends Component {
  constructor() {
    super();
    this.rootCommandTrie = {
      h: {isCommand: true, action: (shiftKey) => this.handleAction('left', shiftKey)},
      j: {isCommand: true, action: (shiftKey) => this.handleAction('down', shiftKey)},
      k: {isCommand: true, action: (shiftKey) => this.handleAction('up', shiftKey)},
      l: {isCommand: true, action: (shiftKey) => this.handleAction('right', shiftKey)},
      x: {isCommand: true, action: (shiftKey) => this.handleAction('delete', shiftKey)},
      w: {isCommand: true, action: (shiftKey) => this.selectNextClue(false)},
      b: {iscommand: true, action: (shiftKey) => this.selectNextClue(true)},
      d: {
        isCommand: false,
        next: {
          d: {
            isCommand: true,
            action: () => {
              this.deleteWord();
            },
          },
        },
      },
      ':': {
        isCommand: true,
        action: (shiftKey) => {
          this.props.onSetVimMode(vimModes.COMMAND);
          this.props.onSetCmdline(':');
        },
      },
      i: {isCommand: true, action: (shiftKey) => this.props.onSetVimMode(vimModes.INSERT)},
    };
    this.commandTrie = this.rootCommandTrie;
  }

  get grid() {
    return new GridObject(this.props.grid);
  }

  getSelectedClueNumber() {
    return this.grid.getParent(this.props.selected.r, this.props.selected.c, this.props.direction);
  }

  componentDidMount() {
    this.focus();
  }

  selectNextClue(backwards, parallel = false) {
    const {direction, clueNumber} = this.grid.getNextClue(
      this.getSelectedClueNumber(),
      this.props.direction,
      this.props.clues,
      backwards,
      parallel
    );
    this.selectClue(direction, clueNumber);
  }

  selectClue(direction, number) {
    this.setDirection(direction);
    const clueRoot = this.grid.getCellByNumber(number);
    const firstEmptyCell = this.grid.getNextEmptyCell(clueRoot.r, clueRoot.c, direction);
    this.setSelected(firstEmptyCell || clueRoot);
  }

  isSelectable(r, c) {
    return this.props.editMode || this.grid.isWhite(r, c);
  }

  flipDirection() {
    if (this.props.direction === 'across') {
      if (this.canSetDirection('down')) {
        this.setDirection('down');
      }
    } else {
      if (this.canSetDirection('across')) {
        this.setDirection('across');
      }
    }
  }

  // factored out handleAction for mobileGridControls
  handleAction(action, shiftKey) {
    const moveSelectedBy = (dr, dc) => () => {
      const {selected} = this.props;
      let {r, c} = selected;
      const step = () => {
        r += dr;
        c += dc;
      };
      step();
      safe_while(() => this.grid.isInBounds(r, c) && !this.isSelectable(r, c), step);
      if (this.grid.isInBounds(r, c)) {
        this.setSelected({r, c});
      }
    };

    const moveSelectedUsingDirection = (d) => () => {
      const [dr, dc] = this.props.direction === 'down' ? [0, d] : [d, 0];
      return moveSelectedBy(dr, dc)();
    };

    const setDirection = (direction, cbk) => () => {
      if (this.props.direction !== direction) {
        if (this.canSetDirection(direction)) {
          this.setDirection(direction);
        } else {
          cbk();
        }
      } else {
        cbk();
      }
    };

    const actions = {
      left: setDirection('across', moveSelectedBy(0, -1)),
      up: setDirection('down', moveSelectedBy(-1, 0)),
      down: setDirection('down', moveSelectedBy(1, 0)),
      right: setDirection('across', moveSelectedBy(0, 1)),
      forward: moveSelectedUsingDirection(1),
      backward: moveSelectedUsingDirection(-1),
      backspace: this.backspace.bind(this),
      delete: this.delete.bind(this),
      tab: this.selectNextClue.bind(this),
      space: this.flipDirection.bind(this),
    };

    if (!(action in actions)) {
      console.error('illegal action', action);
      return; // weird!
    }
    actions[action](shiftKey);
  }

  validLetter(letter) {
    const VALID_SYMBOLS = '!@#$%^&*()-+=`~/?\\'; // special theme puzzles have these sometimes;
    if (VALID_SYMBOLS.indexOf(letter) !== -1) return true;
    return letter.match(/^[A-Z0-9]$/);
  }

  // takes in key, a string
  _handleKeyDown = (key, shiftKey) => {
    const actionKeys = {
      ArrowLeft: 'left',
      ArrowUp: 'up',
      ArrowDown: 'down',
      ArrowRight: 'right',
      Backspace: 'backspace',
      '{del}': 'backspace',
      Delete: 'delete',
      Tab: 'tab',
      ' ': 'space',
      '[': 'backward',
      ']': 'forward',
    };

    const {onPressEnter, onPressPeriod, onPressEscape} = this.props;
    if (key in actionKeys) {
      this.handleAction(actionKeys[key], shiftKey);
      return true;
    } else if (key === '.') {
      onPressPeriod && onPressPeriod();
      return true;
    } else if (key === 'Enter') {
      onPressEnter && onPressEnter();
      return true;
    } else if (key === 'Escape') {
      onPressEscape && onPressEscape();
    } else if (!this.props.frozen) {
      const letter = key.toUpperCase();
      if (this.validLetter(letter)) {
        this.typeLetter(letter, shiftKey);
        return true;
      }
    }
  };

  _handleKeyDownVim = (key, shiftKey) => {
    const actionKeys = {
      ArrowLeft: 'left',
      ArrowUp: 'up',
      ArrowDown: 'down',
      ArrowRight: 'right',
      Backspace: 'backspace',
      '{del}': 'backspace',
      Delete: 'delete',
      Tab: 'tab',
      ' ': 'space',
      '[': 'backward',
      ']': 'forward',
    };

    const {vimMode, onSetVimMode, cmdline, onSetCmdline, onPressEnter, onPressPeriod} = this.props;

    // handle universal keys first e.g. Enter, Arrow keys, etc.
    if (key in actionKeys) {
      this.handleAction(actionKeys[key], shiftKey);
      return true;
    } else if (key === '.') {
      onPressPeriod && onPressPeriod();
      return true;
      // } else if (key === 'Enter') {
      // onPressEnter && onPressEnter();
      // return true;
    } else if (key === 'Escape') {
      onSetVimMode && onSetVimMode(vimModes.NORMAL);
    }
    // handle vim normal mode commands using command trie
    else if (vimMode === vimModes.NORMAL) {
      if (key in this.commandTrie) {
        if (this.commandTrie[key].isCommand) {
          this.commandTrie[key].action(shiftKey);
        } else {
          this.commandTrie = this.commandTrie[key].next;
        }
      } else {
        this.commandTrie = this.rootCommandTrie;
      }
      return true;
    }
    // handle vim insert mode with default behavior
    else if (vimMode === vimModes.INSERT && !this.props.frozen) {
      const letter = key.toUpperCase();
      if (this.validLetter(letter)) {
        this.typeLetter(letter, shiftKey);
        return true;
      }
    }
    // handle vim command mode i.e. pressing ':' in normal mode
    else if (vimMode === vimModes.COMMAND) {
      if (key === 'Backspace') {
        onSetCmdline(cmdline.slice(0, -1));
      } else if (key === 'Enter') {
        this.selectClue(parseInt(cmdline.slice(1, -1)), cmdline[-1] === 'd' ? 'down' : 'across');
        onSetCmdline('');
      } else {
        onSetCmdline(cmdline + key);
      }
    }
  };

  // takes in a Keyboard Event
  handleKeyDown(ev) {
    const {keybind} = this.props;
    const _handleKeyDown = keybind == keybinds.VIM ? this._handleKeyDownVim : this._handleKeyDown;

    if (ev.target.tagName === 'INPUT' || ev.metaKey || ev.ctrlKey) {
      return;
    }
    if (_handleKeyDown(ev.key, ev.shiftKey)) {
      ev.preventDefault();
      ev.stopPropagation();
    }
  }

  goToNextEmptyCell({nextClueIfFilled = false} = {}) {
    let {r, c} = this.props.selected;
    const nextEmptyCell = this.grid.getNextEmptyCell(r, c, this.props.direction, {
      skipFirst: true,
    });
    if (nextEmptyCell) {
      this.setSelected(nextEmptyCell);
      return nextEmptyCell;
    } else {
      const nextCell = this.grid.getNextCell(r, c, this.props.direction);
      if (nextCell) {
        this.setSelected(nextCell);
        return nextCell;
      } else if (nextClueIfFilled) {
        this.selectNextClue();
      }
    }
  }

  goToPreviousCell() {
    let {r, c} = this.props.selected;
    const grid = this.props.grid;
    const step = () => {
      if (this.props.direction === 'across') {
        if (c > 0) {
          c--;
        } else {
          c = grid[0].length - 1;
          r--;
        }
      } else {
        if (r > 0) {
          r--;
        } else {
          r = grid.length - 1;
          c--;
        }
      }
    };
    const ok = () => {
      return this.grid.isInBounds(r, c) && this.grid.isWhite(r, c);
    };
    step();
    safe_while(() => this.grid.isInBounds(r, c) && !ok(), step);
    if (ok()) {
      this.setSelected({r, c});
      return {r, c};
    }
  }

  typeLetter(letter, isRebus, {nextClueIfFilled} = {}) {
    if (this.props.beta) {
      return this.typeLetterSync(letter, isRebus, {nextClueIfFilled});
    }
    if (!this.nextTime) this.nextTime = Date.now();
    setTimeout(() => {
      if (letter === '/') isRebus = true;
      const {r, c} = this.props.selected;
      const value = this.props.grid[r][c].value;
      if (!isRebus) {
        this.goToNextEmptyCell({nextClueIfFilled});
      }
      this.props.updateGrid(r, c, isRebus ? (value || '').substr(0, 10) + letter : letter);
    }, Math.max(0, this.nextTime - Date.now()));
    this.nextTime = Math.max(this.nextTime, Date.now()) + 30;
  }

  typeLetterSync(letter, isRebus, {nextClueIfFilled} = {}) {
    if (letter === '/') isRebus = true;
    const {r, c} = this.props.selected;
    const value = this.props.grid[r][c].value;
    if (!isRebus) {
      this.goToNextEmptyCell({nextClueIfFilled});
    }
    this.props.updateGrid(r, c, isRebus ? (value || '').substr(0, 10) + letter : letter);
  }

  // Returns true if the letter was successfully deleted
  delete() {
    let {r, c} = this.props.selected;
    if (this.props.grid[r][c].value !== '' && !this.props.grid[r][c].good) {
      this.props.updateGrid(r, c, '');
      return true;
    }
    return false;
  }

  deleteWord() {
    let {r, c} = this.props.selected;
    console.log('delete called');
  }

  backspace(shouldStay) {
    if (!this.delete() && !shouldStay) {
      const cell = this.goToPreviousCell();
      if (cell) {
        this.props.updateGrid(cell.r, cell.c, '');
      }
    }
  }

  isGridFilled() {
    return this.grid.isGridFilled();
  }

  setDirection(direction) {
    this.props.onSetDirection(direction);
  }

  canSetDirection(direction) {
    return this.props.canSetDirection(direction);
  }

  setSelected(selected) {
    this.props.onSetSelected(selected);
  }

  focus() {
    this.refs.gridControls.focus();
  }

  render() {
    return (
      <div
        ref="gridControls"
        className="grid-controls"
        tabIndex="1"
        onKeyDown={this.handleKeyDown.bind(this)}
      >
        <div className="grid--content">{this.props.children}</div>
      </div>
    );
  }
}
