// Execute both extension variants with strict GNOME ownership/GType test doubles.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const registered = new WeakSet();
class Actor {
    constructor(props = {}) { Object.assign(this, props); this.clutter_text = {}; }
    add_child() {}
    add_style_class_name() {}
    add_style_pseudo_class() {}
    remove_style_pseudo_class() {}
}
class Menu {
    constructor() { this.items = []; }
    connect() {}
    addMenuItem(item) { item.parent = this; this.items.push(item); }
    removeAll() { this.items = []; }
    close() { this.closed = true; }
    top() { return this.parent ? this.parent.top() : this; }
}
class Item extends Actor {
    constructor(label) { super(); this.label = label; this.signals = {}; }
    connect(name, cb) { this.signals[name] = cb; }
}
class SubMenu extends Item {
    constructor(label) { super(label); this.menu = new Menu(); }
}
class Button extends Actor {
    constructor() {
        super(); assert(registered.has(new.target), 'Indicator must have a GType');
        this.menu = new Menu();
    }
}
class Dialog extends Actor {
    constructor() {
        super(); assert(registered.has(new.target), 'Dialog must have a GType');
        this.contentLayout = new Actor(); this.signals = {};
    }
    setButtons(buttons) { this.buttons = buttons; }
    connect(name, cb) { this.signals[name] = cb; }
    close() { this.closing = true; }
    open() { Dialog.last = this; }
    finishClose() { this.signals.closed?.(); }
}
for (const version of ['gnome44', 'gnome46']) {
    let source = fs.readFileSync(`src/${version}/extension.js`, 'utf8');
    source = source.split('\n').filter(line => !line.startsWith('import ') &&
        !line.startsWith('const {Clutter,') && !/^const (Main|ModalDialog|PanelMenu|PopupMenu|ExtensionUtils|Me) =/.test(line)).join('\n');
    source = source.replace('export default class', 'class');
    source += '\nglobalThis.classes = {Indicator, TextDialog, NewlineDialog, ClipboardTyperExtension};';
    const context = {
        GObject: {registerClass(cls) { registered.add(cls); return cls; }},
        Clutter: {ActorAlign: {START: 0}, KEY_Escape: 9},
        St: {Icon: Actor, Label: Actor, ScrollView: class extends Actor {set_child() {} add_actor() {}}},
        ModalDialog: {ModalDialog: Dialog}, PanelMenu: {Button},
        PopupMenu: {PopupMenuSection: Menu, PopupMenuItem: Item, PopupSubMenuMenuItem: SubMenu,
            PopupSeparatorMenuItem: Item, PopupSwitchMenuItem: Item}, Extension: class {},
    };
    vm.runInNewContext(source, context);
    const {Indicator, TextDialog, ClipboardTyperExtension} = context.classes;
    const text = 'English Русский with spaces\nsecond line\r\n'.repeat(10000);
    const ext = {history: [text], settings: {get_boolean: () => false, get_int: () => 50}, isX11: () => true};
    const indicator = new Indicator(ext);
    const section = indicator.menu.items[0];
    assert(section instanceof Menu);
    assert.equal(section.top(), indicator.menu, `${version}: history must belong to top menu`);
    indicator.rebuild();
    assert.equal(indicator.menu.items.filter(item => item instanceof Menu).length, 1);
    new TextDialog(text, () => {});
    const extension = new ClipboardTyperExtension();
    extension._indicator = indicator;
    const typed = [];
    extension._startTyping = value => typed.push(value);
    extension.requestTyping('hello world');
    assert.deepEqual(typed, ['hello world']);
    extension.requestTyping(text);
    assert(indicator.menu.closed);
    Dialog.last.buttons.find(b => b.label === 'Сохранить переносы').action();
    assert.equal(typed.length, 1, 'Wait until modal grab is released');
    Dialog.last.finishClose();
    assert.equal(typed[1], text);
    extension.requestTyping(text);
    Dialog.last.buttons.find(b => b.label === 'Заменить пробелами').action();
    Dialog.last.finishClose();
    assert.equal(typed[2], text.replace(/\r\n|\r|\n/g, ' '));
    console.log(`${version}: registration, menu ownership, long text and newline choices passed`);
}
