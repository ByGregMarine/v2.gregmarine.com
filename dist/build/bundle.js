
(function(l, r) { if (!l || l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (self.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(self.document);
var app = (function () {
    'use strict';

    function noop() { }
    const identity = x => x;
    function assign(tar, src) {
        // @ts-ignore
        for (const k in src)
            tar[k] = src[k];
        return tar;
    }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    let src_url_equal_anchor;
    function src_url_equal(element_src, url) {
        if (!src_url_equal_anchor) {
            src_url_equal_anchor = document.createElement('a');
        }
        src_url_equal_anchor.href = url;
        return element_src === src_url_equal_anchor.href;
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }
    function validate_store(store, name) {
        if (store != null && typeof store.subscribe !== 'function') {
            throw new Error(`'${name}' is not a store with a 'subscribe' method`);
        }
    }
    function subscribe(store, ...callbacks) {
        if (store == null) {
            return noop;
        }
        const unsub = store.subscribe(...callbacks);
        return unsub.unsubscribe ? () => unsub.unsubscribe() : unsub;
    }
    function get_store_value(store) {
        let value;
        subscribe(store, _ => value = _)();
        return value;
    }
    function component_subscribe(component, store, callback) {
        component.$$.on_destroy.push(subscribe(store, callback));
    }
    function create_slot(definition, ctx, $$scope, fn) {
        if (definition) {
            const slot_ctx = get_slot_context(definition, ctx, $$scope, fn);
            return definition[0](slot_ctx);
        }
    }
    function get_slot_context(definition, ctx, $$scope, fn) {
        return definition[1] && fn
            ? assign($$scope.ctx.slice(), definition[1](fn(ctx)))
            : $$scope.ctx;
    }
    function get_slot_changes(definition, $$scope, dirty, fn) {
        if (definition[2] && fn) {
            const lets = definition[2](fn(dirty));
            if ($$scope.dirty === undefined) {
                return lets;
            }
            if (typeof lets === 'object') {
                const merged = [];
                const len = Math.max($$scope.dirty.length, lets.length);
                for (let i = 0; i < len; i += 1) {
                    merged[i] = $$scope.dirty[i] | lets[i];
                }
                return merged;
            }
            return $$scope.dirty | lets;
        }
        return $$scope.dirty;
    }
    function update_slot_base(slot, slot_definition, ctx, $$scope, slot_changes, get_slot_context_fn) {
        if (slot_changes) {
            const slot_context = get_slot_context(slot_definition, ctx, $$scope, get_slot_context_fn);
            slot.p(slot_context, slot_changes);
        }
    }
    function get_all_dirty_from_scope($$scope) {
        if ($$scope.ctx.length > 32) {
            const dirty = [];
            const length = $$scope.ctx.length / 32;
            for (let i = 0; i < length; i++) {
                dirty[i] = -1;
            }
            return dirty;
        }
        return -1;
    }
    function exclude_internal_props(props) {
        const result = {};
        for (const k in props)
            if (k[0] !== '$')
                result[k] = props[k];
        return result;
    }
    function action_destroyer(action_result) {
        return action_result && is_function(action_result.destroy) ? action_result.destroy : noop;
    }

    const is_client = typeof window !== 'undefined';
    let now = is_client
        ? () => window.performance.now()
        : () => Date.now();
    let raf = is_client ? cb => requestAnimationFrame(cb) : noop;

    const tasks = new Set();
    function run_tasks(now) {
        tasks.forEach(task => {
            if (!task.c(now)) {
                tasks.delete(task);
                task.f();
            }
        });
        if (tasks.size !== 0)
            raf(run_tasks);
    }
    /**
     * Creates a new task that runs on each raf frame
     * until it returns a falsy value or is aborted
     */
    function loop(callback) {
        let task;
        if (tasks.size === 0)
            raf(run_tasks);
        return {
            promise: new Promise(fulfill => {
                tasks.add(task = { c: callback, f: fulfill });
            }),
            abort() {
                tasks.delete(task);
            }
        };
    }

    // Track which nodes are claimed during hydration. Unclaimed nodes can then be removed from the DOM
    // at the end of hydration without touching the remaining nodes.
    let is_hydrating = false;
    function start_hydrating() {
        is_hydrating = true;
    }
    function end_hydrating() {
        is_hydrating = false;
    }
    function upper_bound(low, high, key, value) {
        // Return first index of value larger than input value in the range [low, high)
        while (low < high) {
            const mid = low + ((high - low) >> 1);
            if (key(mid) <= value) {
                low = mid + 1;
            }
            else {
                high = mid;
            }
        }
        return low;
    }
    function init_hydrate(target) {
        if (target.hydrate_init)
            return;
        target.hydrate_init = true;
        // We know that all children have claim_order values since the unclaimed have been detached if target is not <head>
        let children = target.childNodes;
        // If target is <head>, there may be children without claim_order
        if (target.nodeName === 'HEAD') {
            const myChildren = [];
            for (let i = 0; i < children.length; i++) {
                const node = children[i];
                if (node.claim_order !== undefined) {
                    myChildren.push(node);
                }
            }
            children = myChildren;
        }
        /*
        * Reorder claimed children optimally.
        * We can reorder claimed children optimally by finding the longest subsequence of
        * nodes that are already claimed in order and only moving the rest. The longest
        * subsequence subsequence of nodes that are claimed in order can be found by
        * computing the longest increasing subsequence of .claim_order values.
        *
        * This algorithm is optimal in generating the least amount of reorder operations
        * possible.
        *
        * Proof:
        * We know that, given a set of reordering operations, the nodes that do not move
        * always form an increasing subsequence, since they do not move among each other
        * meaning that they must be already ordered among each other. Thus, the maximal
        * set of nodes that do not move form a longest increasing subsequence.
        */
        // Compute longest increasing subsequence
        // m: subsequence length j => index k of smallest value that ends an increasing subsequence of length j
        const m = new Int32Array(children.length + 1);
        // Predecessor indices + 1
        const p = new Int32Array(children.length);
        m[0] = -1;
        let longest = 0;
        for (let i = 0; i < children.length; i++) {
            const current = children[i].claim_order;
            // Find the largest subsequence length such that it ends in a value less than our current value
            // upper_bound returns first greater value, so we subtract one
            // with fast path for when we are on the current longest subsequence
            const seqLen = ((longest > 0 && children[m[longest]].claim_order <= current) ? longest + 1 : upper_bound(1, longest, idx => children[m[idx]].claim_order, current)) - 1;
            p[i] = m[seqLen] + 1;
            const newLen = seqLen + 1;
            // We can guarantee that current is the smallest value. Otherwise, we would have generated a longer sequence.
            m[newLen] = i;
            longest = Math.max(newLen, longest);
        }
        // The longest increasing subsequence of nodes (initially reversed)
        const lis = [];
        // The rest of the nodes, nodes that will be moved
        const toMove = [];
        let last = children.length - 1;
        for (let cur = m[longest] + 1; cur != 0; cur = p[cur - 1]) {
            lis.push(children[cur - 1]);
            for (; last >= cur; last--) {
                toMove.push(children[last]);
            }
            last--;
        }
        for (; last >= 0; last--) {
            toMove.push(children[last]);
        }
        lis.reverse();
        // We sort the nodes being moved to guarantee that their insertion order matches the claim order
        toMove.sort((a, b) => a.claim_order - b.claim_order);
        // Finally, we move the nodes
        for (let i = 0, j = 0; i < toMove.length; i++) {
            while (j < lis.length && toMove[i].claim_order >= lis[j].claim_order) {
                j++;
            }
            const anchor = j < lis.length ? lis[j] : null;
            target.insertBefore(toMove[i], anchor);
        }
    }
    function append(target, node) {
        target.appendChild(node);
    }
    function get_root_for_style(node) {
        if (!node)
            return document;
        const root = node.getRootNode ? node.getRootNode() : node.ownerDocument;
        if (root && root.host) {
            return root;
        }
        return node.ownerDocument;
    }
    function append_empty_stylesheet(node) {
        const style_element = element('style');
        append_stylesheet(get_root_for_style(node), style_element);
        return style_element;
    }
    function append_stylesheet(node, style) {
        append(node.head || node, style);
    }
    function append_hydration(target, node) {
        if (is_hydrating) {
            init_hydrate(target);
            if ((target.actual_end_child === undefined) || ((target.actual_end_child !== null) && (target.actual_end_child.parentElement !== target))) {
                target.actual_end_child = target.firstChild;
            }
            // Skip nodes of undefined ordering
            while ((target.actual_end_child !== null) && (target.actual_end_child.claim_order === undefined)) {
                target.actual_end_child = target.actual_end_child.nextSibling;
            }
            if (node !== target.actual_end_child) {
                // We only insert if the ordering of this node should be modified or the parent node is not target
                if (node.claim_order !== undefined || node.parentNode !== target) {
                    target.insertBefore(node, target.actual_end_child);
                }
            }
            else {
                target.actual_end_child = node.nextSibling;
            }
        }
        else if (node.parentNode !== target || node.nextSibling !== null) {
            target.appendChild(node);
        }
    }
    function insert_hydration(target, node, anchor) {
        if (is_hydrating && !anchor) {
            append_hydration(target, node);
        }
        else if (node.parentNode !== target || node.nextSibling != anchor) {
            target.insertBefore(node, anchor || null);
        }
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function destroy_each(iterations, detaching) {
        for (let i = 0; i < iterations.length; i += 1) {
            if (iterations[i])
                iterations[i].d(detaching);
        }
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function empty() {
        return text('');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function set_custom_element_data(node, prop, value) {
        if (prop in node) {
            node[prop] = typeof node[prop] === 'boolean' && value === '' ? true : value;
        }
        else {
            attr(node, prop, value);
        }
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function init_claim_info(nodes) {
        if (nodes.claim_info === undefined) {
            nodes.claim_info = { last_index: 0, total_claimed: 0 };
        }
    }
    function claim_node(nodes, predicate, processNode, createNode, dontUpdateLastIndex = false) {
        // Try to find nodes in an order such that we lengthen the longest increasing subsequence
        init_claim_info(nodes);
        const resultNode = (() => {
            // We first try to find an element after the previous one
            for (let i = nodes.claim_info.last_index; i < nodes.length; i++) {
                const node = nodes[i];
                if (predicate(node)) {
                    const replacement = processNode(node);
                    if (replacement === undefined) {
                        nodes.splice(i, 1);
                    }
                    else {
                        nodes[i] = replacement;
                    }
                    if (!dontUpdateLastIndex) {
                        nodes.claim_info.last_index = i;
                    }
                    return node;
                }
            }
            // Otherwise, we try to find one before
            // We iterate in reverse so that we don't go too far back
            for (let i = nodes.claim_info.last_index - 1; i >= 0; i--) {
                const node = nodes[i];
                if (predicate(node)) {
                    const replacement = processNode(node);
                    if (replacement === undefined) {
                        nodes.splice(i, 1);
                    }
                    else {
                        nodes[i] = replacement;
                    }
                    if (!dontUpdateLastIndex) {
                        nodes.claim_info.last_index = i;
                    }
                    else if (replacement === undefined) {
                        // Since we spliced before the last_index, we decrease it
                        nodes.claim_info.last_index--;
                    }
                    return node;
                }
            }
            // If we can't find any matching node, we create a new one
            return createNode();
        })();
        resultNode.claim_order = nodes.claim_info.total_claimed;
        nodes.claim_info.total_claimed += 1;
        return resultNode;
    }
    function claim_element_base(nodes, name, attributes, create_element) {
        return claim_node(nodes, (node) => node.nodeName === name, (node) => {
            const remove = [];
            for (let j = 0; j < node.attributes.length; j++) {
                const attribute = node.attributes[j];
                if (!attributes[attribute.name]) {
                    remove.push(attribute.name);
                }
            }
            remove.forEach(v => node.removeAttribute(v));
            return undefined;
        }, () => create_element(name));
    }
    function claim_element(nodes, name, attributes) {
        return claim_element_base(nodes, name, attributes, element);
    }
    function claim_text(nodes, data) {
        return claim_node(nodes, (node) => node.nodeType === 3, (node) => {
            const dataStr = '' + data;
            if (node.data.startsWith(dataStr)) {
                if (node.data.length !== dataStr.length) {
                    return node.splitText(dataStr.length);
                }
            }
            else {
                node.data = dataStr;
            }
        }, () => text(data), true // Text nodes should not update last index since it is likely not worth it to eliminate an increasing subsequence of actual elements
        );
    }
    function claim_space(nodes) {
        return claim_text(nodes, ' ');
    }
    function custom_event(type, detail, bubbles = false) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, bubbles, false, detail);
        return e;
    }

    const active_docs = new Set();
    let active = 0;
    // https://github.com/darkskyapp/string-hash/blob/master/index.js
    function hash(str) {
        let hash = 5381;
        let i = str.length;
        while (i--)
            hash = ((hash << 5) - hash) ^ str.charCodeAt(i);
        return hash >>> 0;
    }
    function create_rule(node, a, b, duration, delay, ease, fn, uid = 0) {
        const step = 16.666 / duration;
        let keyframes = '{\n';
        for (let p = 0; p <= 1; p += step) {
            const t = a + (b - a) * ease(p);
            keyframes += p * 100 + `%{${fn(t, 1 - t)}}\n`;
        }
        const rule = keyframes + `100% {${fn(b, 1 - b)}}\n}`;
        const name = `__svelte_${hash(rule)}_${uid}`;
        const doc = get_root_for_style(node);
        active_docs.add(doc);
        const stylesheet = doc.__svelte_stylesheet || (doc.__svelte_stylesheet = append_empty_stylesheet(node).sheet);
        const current_rules = doc.__svelte_rules || (doc.__svelte_rules = {});
        if (!current_rules[name]) {
            current_rules[name] = true;
            stylesheet.insertRule(`@keyframes ${name} ${rule}`, stylesheet.cssRules.length);
        }
        const animation = node.style.animation || '';
        node.style.animation = `${animation ? `${animation}, ` : ''}${name} ${duration}ms linear ${delay}ms 1 both`;
        active += 1;
        return name;
    }
    function delete_rule(node, name) {
        const previous = (node.style.animation || '').split(', ');
        const next = previous.filter(name
            ? anim => anim.indexOf(name) < 0 // remove specific animation
            : anim => anim.indexOf('__svelte') === -1 // remove all Svelte animations
        );
        const deleted = previous.length - next.length;
        if (deleted) {
            node.style.animation = next.join(', ');
            active -= deleted;
            if (!active)
                clear_rules();
        }
    }
    function clear_rules() {
        raf(() => {
            if (active)
                return;
            active_docs.forEach(doc => {
                const stylesheet = doc.__svelte_stylesheet;
                let i = stylesheet.cssRules.length;
                while (i--)
                    stylesheet.deleteRule(i);
                doc.__svelte_rules = {};
            });
            active_docs.clear();
        });
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function get_current_component() {
        if (!current_component)
            throw new Error('Function called outside component initialization');
        return current_component;
    }
    function beforeUpdate(fn) {
        get_current_component().$$.before_update.push(fn);
    }
    function onMount(fn) {
        get_current_component().$$.on_mount.push(fn);
    }
    function afterUpdate(fn) {
        get_current_component().$$.after_update.push(fn);
    }
    function onDestroy(fn) {
        get_current_component().$$.on_destroy.push(fn);
    }
    function setContext(key, context) {
        get_current_component().$$.context.set(key, context);
    }
    function getContext(key) {
        return get_current_component().$$.context.get(key);
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    let flushing = false;
    const seen_callbacks = new Set();
    function flush() {
        if (flushing)
            return;
        flushing = true;
        do {
            // first, call beforeUpdate functions
            // and update components
            for (let i = 0; i < dirty_components.length; i += 1) {
                const component = dirty_components[i];
                set_current_component(component);
                update(component.$$);
            }
            set_current_component(null);
            dirty_components.length = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        flushing = false;
        seen_callbacks.clear();
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }

    let promise;
    function wait() {
        if (!promise) {
            promise = Promise.resolve();
            promise.then(() => {
                promise = null;
            });
        }
        return promise;
    }
    function dispatch(node, direction, kind) {
        node.dispatchEvent(custom_event(`${direction ? 'intro' : 'outro'}${kind}`));
    }
    const outroing = new Set();
    let outros;
    function group_outros() {
        outros = {
            r: 0,
            c: [],
            p: outros // parent group
        };
    }
    function check_outros() {
        if (!outros.r) {
            run_all(outros.c);
        }
        outros = outros.p;
    }
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
    }
    const null_transition = { duration: 0 };
    function create_in_transition(node, fn, params) {
        let config = fn(node, params);
        let running = false;
        let animation_name;
        let task;
        let uid = 0;
        function cleanup() {
            if (animation_name)
                delete_rule(node, animation_name);
        }
        function go() {
            const { delay = 0, duration = 300, easing = identity, tick = noop, css } = config || null_transition;
            if (css)
                animation_name = create_rule(node, 0, 1, duration, delay, easing, css, uid++);
            tick(0, 1);
            const start_time = now() + delay;
            const end_time = start_time + duration;
            if (task)
                task.abort();
            running = true;
            add_render_callback(() => dispatch(node, true, 'start'));
            task = loop(now => {
                if (running) {
                    if (now >= end_time) {
                        tick(1, 0);
                        dispatch(node, true, 'end');
                        cleanup();
                        return running = false;
                    }
                    if (now >= start_time) {
                        const t = easing((now - start_time) / duration);
                        tick(t, 1 - t);
                    }
                }
                return running;
            });
        }
        let started = false;
        return {
            start() {
                if (started)
                    return;
                started = true;
                delete_rule(node);
                if (is_function(config)) {
                    config = config();
                    wait().then(go);
                }
                else {
                    go();
                }
            },
            invalidate() {
                started = false;
            },
            end() {
                if (running) {
                    cleanup();
                    running = false;
                }
            }
        };
    }

    function get_spread_update(levels, updates) {
        const update = {};
        const to_null_out = {};
        const accounted_for = { $$scope: 1 };
        let i = levels.length;
        while (i--) {
            const o = levels[i];
            const n = updates[i];
            if (n) {
                for (const key in o) {
                    if (!(key in n))
                        to_null_out[key] = 1;
                }
                for (const key in n) {
                    if (!accounted_for[key]) {
                        update[key] = n[key];
                        accounted_for[key] = 1;
                    }
                }
                levels[i] = n;
            }
            else {
                for (const key in o) {
                    accounted_for[key] = 1;
                }
            }
        }
        for (const key in to_null_out) {
            if (!(key in update))
                update[key] = undefined;
        }
        return update;
    }
    function get_spread_object(spread_props) {
        return typeof spread_props === 'object' && spread_props !== null ? spread_props : {};
    }
    function create_component(block) {
        block && block.c();
    }
    function claim_component(block, parent_nodes) {
        block && block.l(parent_nodes);
    }
    function mount_component(component, target, anchor, customElement) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        if (!customElement) {
            // onMount happens before the initial afterUpdate
            add_render_callback(() => {
                const new_on_destroy = on_mount.map(run).filter(is_function);
                if (on_destroy) {
                    on_destroy.push(...new_on_destroy);
                }
                else {
                    // Edge case - component was destroyed immediately,
                    // most likely as a result of a binding initialising
                    run_all(new_on_destroy);
                }
                component.$$.on_mount = [];
            });
        }
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, append_styles, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            on_disconnect: [],
            before_update: [],
            after_update: [],
            context: new Map(options.context || (parent_component ? parent_component.$$.context : [])),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false,
            root: options.target || parent_component.$$.root
        };
        append_styles && append_styles($$.root);
        let ready = false;
        $$.ctx = instance
            ? instance(component, options.props || {}, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                start_hydrating();
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor, options.customElement);
            end_hydrating();
            flush();
        }
        set_current_component(parent_component);
    }
    /**
     * Base class for Svelte components. Used when dev=false.
     */
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.44.1' }, detail), true));
    }
    function append_hydration_dev(target, node) {
        dispatch_dev('SvelteDOMInsert', { target, node });
        append_hydration(target, node);
    }
    function insert_hydration_dev(target, node, anchor) {
        dispatch_dev('SvelteDOMInsert', { target, node, anchor });
        insert_hydration(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev('SvelteDOMRemove', { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation) {
        const modifiers = options === true ? ['capture'] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        dispatch_dev('SvelteDOMAddEventListener', { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev('SvelteDOMRemoveEventListener', { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev('SvelteDOMRemoveAttribute', { node, attribute });
        else
            dispatch_dev('SvelteDOMSetAttribute', { node, attribute, value });
    }
    function set_data_dev(text, data) {
        data = '' + data;
        if (text.wholeText === data)
            return;
        dispatch_dev('SvelteDOMSetData', { node: text, data });
        text.data = data;
    }
    function validate_each_argument(arg) {
        if (typeof arg !== 'string' && !(arg && typeof arg === 'object' && 'length' in arg)) {
            let msg = '{#each} only iterates over array-like objects.';
            if (typeof Symbol === 'function' && arg && Symbol.iterator in arg) {
                msg += ' You can use a spread to convert this iterable into an array.';
            }
            throw new Error(msg);
        }
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    /**
     * Base class for Svelte components with some minor dev-enhancements. Used when dev=true.
     */
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error("'target' is a required option");
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn('Component was already destroyed'); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    const subscriber_queue = [];
    /**
     * Creates a `Readable` store that allows reading by subscription.
     * @param value initial value
     * @param {StartStopNotifier}start start and stop notifications for subscriptions
     */
    function readable(value, start) {
        return {
            subscribe: writable(value, start).subscribe
        };
    }
    /**
     * Create a `Writable` store that allows both updating and reading by subscription.
     * @param {*=}value initial value
     * @param {StartStopNotifier=}start start and stop notifications for subscriptions
     */
    function writable(value, start = noop) {
        let stop;
        const subscribers = new Set();
        function set(new_value) {
            if (safe_not_equal(value, new_value)) {
                value = new_value;
                if (stop) { // store is ready
                    const run_queue = !subscriber_queue.length;
                    for (const subscriber of subscribers) {
                        subscriber[1]();
                        subscriber_queue.push(subscriber, value);
                    }
                    if (run_queue) {
                        for (let i = 0; i < subscriber_queue.length; i += 2) {
                            subscriber_queue[i][0](subscriber_queue[i + 1]);
                        }
                        subscriber_queue.length = 0;
                    }
                }
            }
        }
        function update(fn) {
            set(fn(value));
        }
        function subscribe(run, invalidate = noop) {
            const subscriber = [run, invalidate];
            subscribers.add(subscriber);
            if (subscribers.size === 1) {
                stop = start(set) || noop;
            }
            run(value);
            return () => {
                subscribers.delete(subscriber);
                if (subscribers.size === 0) {
                    stop();
                    stop = null;
                }
            };
        }
        return { set, update, subscribe };
    }
    function derived(stores, fn, initial_value) {
        const single = !Array.isArray(stores);
        const stores_array = single
            ? [stores]
            : stores;
        const auto = fn.length < 2;
        return readable(initial_value, (set) => {
            let inited = false;
            const values = [];
            let pending = 0;
            let cleanup = noop;
            const sync = () => {
                if (pending) {
                    return;
                }
                cleanup();
                const result = fn(single ? values[0] : values, set);
                if (auto) {
                    set(result);
                }
                else {
                    cleanup = is_function(result) ? result : noop;
                }
            };
            const unsubscribers = stores_array.map((store, i) => subscribe(store, (value) => {
                values[i] = value;
                pending &= ~(1 << i);
                if (inited) {
                    sync();
                }
            }, () => {
                pending |= (1 << i);
            }));
            inited = true;
            sync();
            return function stop() {
                run_all(unsubscribers);
                cleanup();
            };
        });
    }

    const LOCATION = {};
    const ROUTER = {};

    /**
     * Adapted from https://github.com/reach/router/blob/b60e6dd781d5d3a4bdaaf4de665649c0f6a7e78d/src/lib/history.js
     *
     * https://github.com/reach/router/blob/master/LICENSE
     * */

    function getLocation(source) {
      return {
        ...source.location,
        state: source.history.state,
        key: (source.history.state && source.history.state.key) || "initial"
      };
    }

    function createHistory(source, options) {
      const listeners = [];
      let location = getLocation(source);

      return {
        get location() {
          return location;
        },

        listen(listener) {
          listeners.push(listener);

          const popstateListener = () => {
            location = getLocation(source);
            listener({ location, action: "POP" });
          };

          source.addEventListener("popstate", popstateListener);

          return () => {
            source.removeEventListener("popstate", popstateListener);

            const index = listeners.indexOf(listener);
            listeners.splice(index, 1);
          };
        },

        navigate(to, { state, replace = false } = {}) {
          state = { ...state, key: Date.now() + "" };
          // try...catch iOS Safari limits to 100 pushState calls
          try {
            if (replace) {
              source.history.replaceState(state, null, to);
            } else {
              source.history.pushState(state, null, to);
            }
          } catch (e) {
            source.location[replace ? "replace" : "assign"](to);
          }

          location = getLocation(source);
          listeners.forEach(listener => listener({ location, action: "PUSH" }));
        }
      };
    }

    // Stores history entries in memory for testing or other platforms like Native
    function createMemorySource(initialPathname = "/") {
      let index = 0;
      const stack = [{ pathname: initialPathname, search: "" }];
      const states = [];

      return {
        get location() {
          return stack[index];
        },
        addEventListener(name, fn) {},
        removeEventListener(name, fn) {},
        history: {
          get entries() {
            return stack;
          },
          get index() {
            return index;
          },
          get state() {
            return states[index];
          },
          pushState(state, _, uri) {
            const [pathname, search = ""] = uri.split("?");
            index++;
            stack.push({ pathname, search });
            states.push(state);
          },
          replaceState(state, _, uri) {
            const [pathname, search = ""] = uri.split("?");
            stack[index] = { pathname, search };
            states[index] = state;
          }
        }
      };
    }

    // Global history uses window.history as the source if available,
    // otherwise a memory history
    const canUseDOM = Boolean(
      typeof window !== "undefined" &&
        window.document &&
        window.document.createElement
    );
    const globalHistory = createHistory(canUseDOM ? window : createMemorySource());
    const { navigate } = globalHistory;

    /**
     * Adapted from https://github.com/reach/router/blob/b60e6dd781d5d3a4bdaaf4de665649c0f6a7e78d/src/lib/utils.js
     *
     * https://github.com/reach/router/blob/master/LICENSE
     * */

    const paramRe = /^:(.+)/;

    const SEGMENT_POINTS = 4;
    const STATIC_POINTS = 3;
    const DYNAMIC_POINTS = 2;
    const SPLAT_PENALTY = 1;
    const ROOT_POINTS = 1;

    /**
     * Check if `segment` is a root segment
     * @param {string} segment
     * @return {boolean}
     */
    function isRootSegment(segment) {
      return segment === "";
    }

    /**
     * Check if `segment` is a dynamic segment
     * @param {string} segment
     * @return {boolean}
     */
    function isDynamic(segment) {
      return paramRe.test(segment);
    }

    /**
     * Check if `segment` is a splat
     * @param {string} segment
     * @return {boolean}
     */
    function isSplat(segment) {
      return segment[0] === "*";
    }

    /**
     * Split up the URI into segments delimited by `/`
     * @param {string} uri
     * @return {string[]}
     */
    function segmentize(uri) {
      return (
        uri
          // Strip starting/ending `/`
          .replace(/(^\/+|\/+$)/g, "")
          .split("/")
      );
    }

    /**
     * Strip `str` of potential start and end `/`
     * @param {string} str
     * @return {string}
     */
    function stripSlashes(str) {
      return str.replace(/(^\/+|\/+$)/g, "");
    }

    /**
     * Score a route depending on how its individual segments look
     * @param {object} route
     * @param {number} index
     * @return {object}
     */
    function rankRoute(route, index) {
      const score = route.default
        ? 0
        : segmentize(route.path).reduce((score, segment) => {
            score += SEGMENT_POINTS;

            if (isRootSegment(segment)) {
              score += ROOT_POINTS;
            } else if (isDynamic(segment)) {
              score += DYNAMIC_POINTS;
            } else if (isSplat(segment)) {
              score -= SEGMENT_POINTS + SPLAT_PENALTY;
            } else {
              score += STATIC_POINTS;
            }

            return score;
          }, 0);

      return { route, score, index };
    }

    /**
     * Give a score to all routes and sort them on that
     * @param {object[]} routes
     * @return {object[]}
     */
    function rankRoutes(routes) {
      return (
        routes
          .map(rankRoute)
          // If two routes have the exact same score, we go by index instead
          .sort((a, b) =>
            a.score < b.score ? 1 : a.score > b.score ? -1 : a.index - b.index
          )
      );
    }

    /**
     * Ranks and picks the best route to match. Each segment gets the highest
     * amount of points, then the type of segment gets an additional amount of
     * points where
     *
     *  static > dynamic > splat > root
     *
     * This way we don't have to worry about the order of our routes, let the
     * computers do it.
     *
     * A route looks like this
     *
     *  { path, default, value }
     *
     * And a returned match looks like:
     *
     *  { route, params, uri }
     *
     * @param {object[]} routes
     * @param {string} uri
     * @return {?object}
     */
    function pick(routes, uri) {
      let match;
      let default_;

      const [uriPathname] = uri.split("?");
      const uriSegments = segmentize(uriPathname);
      const isRootUri = uriSegments[0] === "";
      const ranked = rankRoutes(routes);

      for (let i = 0, l = ranked.length; i < l; i++) {
        const route = ranked[i].route;
        let missed = false;

        if (route.default) {
          default_ = {
            route,
            params: {},
            uri
          };
          continue;
        }

        const routeSegments = segmentize(route.path);
        const params = {};
        const max = Math.max(uriSegments.length, routeSegments.length);
        let index = 0;

        for (; index < max; index++) {
          const routeSegment = routeSegments[index];
          const uriSegment = uriSegments[index];

          if (routeSegment !== undefined && isSplat(routeSegment)) {
            // Hit a splat, just grab the rest, and return a match
            // uri:   /files/documents/work
            // route: /files/* or /files/*splatname
            const splatName = routeSegment === "*" ? "*" : routeSegment.slice(1);

            params[splatName] = uriSegments
              .slice(index)
              .map(decodeURIComponent)
              .join("/");
            break;
          }

          if (uriSegment === undefined) {
            // URI is shorter than the route, no match
            // uri:   /users
            // route: /users/:userId
            missed = true;
            break;
          }

          let dynamicMatch = paramRe.exec(routeSegment);

          if (dynamicMatch && !isRootUri) {
            const value = decodeURIComponent(uriSegment);
            params[dynamicMatch[1]] = value;
          } else if (routeSegment !== uriSegment) {
            // Current segments don't match, not dynamic, not splat, so no match
            // uri:   /users/123/settings
            // route: /users/:id/profile
            missed = true;
            break;
          }
        }

        if (!missed) {
          match = {
            route,
            params,
            uri: "/" + uriSegments.slice(0, index).join("/")
          };
          break;
        }
      }

      return match || default_ || null;
    }

    /**
     * Check if the `path` matches the `uri`.
     * @param {string} path
     * @param {string} uri
     * @return {?object}
     */
    function match(route, uri) {
      return pick([route], uri);
    }

    /**
     * Combines the `basepath` and the `path` into one path.
     * @param {string} basepath
     * @param {string} path
     */
    function combinePaths(basepath, path) {
      return `${stripSlashes(
    path === "/" ? basepath : `${stripSlashes(basepath)}/${stripSlashes(path)}`
  )}/`;
    }

    /**
     * Decides whether a given `event` should result in a navigation or not.
     * @param {object} event
     */
    function shouldNavigate(event) {
      return (
        !event.defaultPrevented &&
        event.button === 0 &&
        !(event.metaKey || event.altKey || event.ctrlKey || event.shiftKey)
      );
    }

    function hostMatches(anchor) {
      const host = location.host;
      return (
        anchor.host == host ||
        // svelte seems to kill anchor.host value in ie11, so fall back to checking href
        anchor.href.indexOf(`https://${host}`) === 0 ||
        anchor.href.indexOf(`http://${host}`) === 0
      )
    }

    /* node_modules/svelte-routing/src/Router.svelte generated by Svelte v3.44.1 */

    function create_fragment$a(ctx) {
    	let current;
    	const default_slot_template = /*#slots*/ ctx[9].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[8], null);

    	const block = {
    		c: function create() {
    			if (default_slot) default_slot.c();
    		},
    		l: function claim(nodes) {
    			if (default_slot) default_slot.l(nodes);
    		},
    		m: function mount(target, anchor) {
    			if (default_slot) {
    				default_slot.m(target, anchor);
    			}

    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (default_slot) {
    				if (default_slot.p && (!current || dirty & /*$$scope*/ 256)) {
    					update_slot_base(
    						default_slot,
    						default_slot_template,
    						ctx,
    						/*$$scope*/ ctx[8],
    						!current
    						? get_all_dirty_from_scope(/*$$scope*/ ctx[8])
    						: get_slot_changes(default_slot_template, /*$$scope*/ ctx[8], dirty, null),
    						null
    					);
    				}
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(default_slot, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(default_slot, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (default_slot) default_slot.d(detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$a.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$a($$self, $$props, $$invalidate) {
    	let $location;
    	let $routes;
    	let $base;
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Router', slots, ['default']);
    	let { basepath = "/" } = $$props;
    	let { url = null } = $$props;
    	const locationContext = getContext(LOCATION);
    	const routerContext = getContext(ROUTER);
    	const routes = writable([]);
    	validate_store(routes, 'routes');
    	component_subscribe($$self, routes, value => $$invalidate(6, $routes = value));
    	const activeRoute = writable(null);
    	let hasActiveRoute = false; // Used in SSR to synchronously set that a Route is active.

    	// If locationContext is not set, this is the topmost Router in the tree.
    	// If the `url` prop is given we force the location to it.
    	const location = locationContext || writable(url ? { pathname: url } : globalHistory.location);

    	validate_store(location, 'location');
    	component_subscribe($$self, location, value => $$invalidate(5, $location = value));

    	// If routerContext is set, the routerBase of the parent Router
    	// will be the base for this Router's descendants.
    	// If routerContext is not set, the path and resolved uri will both
    	// have the value of the basepath prop.
    	const base = routerContext
    	? routerContext.routerBase
    	: writable({ path: basepath, uri: basepath });

    	validate_store(base, 'base');
    	component_subscribe($$self, base, value => $$invalidate(7, $base = value));

    	const routerBase = derived([base, activeRoute], ([base, activeRoute]) => {
    		// If there is no activeRoute, the routerBase will be identical to the base.
    		if (activeRoute === null) {
    			return base;
    		}

    		const { path: basepath } = base;
    		const { route, uri } = activeRoute;

    		// Remove the potential /* or /*splatname from
    		// the end of the child Routes relative paths.
    		const path = route.default
    		? basepath
    		: route.path.replace(/\*.*$/, "");

    		return { path, uri };
    	});

    	function registerRoute(route) {
    		const { path: basepath } = $base;
    		let { path } = route;

    		// We store the original path in the _path property so we can reuse
    		// it when the basepath changes. The only thing that matters is that
    		// the route reference is intact, so mutation is fine.
    		route._path = path;

    		route.path = combinePaths(basepath, path);

    		if (typeof window === "undefined") {
    			// In SSR we should set the activeRoute immediately if it is a match.
    			// If there are more Routes being registered after a match is found,
    			// we just skip them.
    			if (hasActiveRoute) {
    				return;
    			}

    			const matchingRoute = match(route, $location.pathname);

    			if (matchingRoute) {
    				activeRoute.set(matchingRoute);
    				hasActiveRoute = true;
    			}
    		} else {
    			routes.update(rs => {
    				rs.push(route);
    				return rs;
    			});
    		}
    	}

    	function unregisterRoute(route) {
    		routes.update(rs => {
    			const index = rs.indexOf(route);
    			rs.splice(index, 1);
    			return rs;
    		});
    	}

    	if (!locationContext) {
    		// The topmost Router in the tree is responsible for updating
    		// the location store and supplying it through context.
    		onMount(() => {
    			const unlisten = globalHistory.listen(history => {
    				location.set(history.location);
    			});

    			return unlisten;
    		});

    		setContext(LOCATION, location);
    	}

    	setContext(ROUTER, {
    		activeRoute,
    		base,
    		routerBase,
    		registerRoute,
    		unregisterRoute
    	});

    	const writable_props = ['basepath', 'url'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Router> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('basepath' in $$props) $$invalidate(3, basepath = $$props.basepath);
    		if ('url' in $$props) $$invalidate(4, url = $$props.url);
    		if ('$$scope' in $$props) $$invalidate(8, $$scope = $$props.$$scope);
    	};

    	$$self.$capture_state = () => ({
    		getContext,
    		setContext,
    		onMount,
    		writable,
    		derived,
    		LOCATION,
    		ROUTER,
    		globalHistory,
    		pick,
    		match,
    		stripSlashes,
    		combinePaths,
    		basepath,
    		url,
    		locationContext,
    		routerContext,
    		routes,
    		activeRoute,
    		hasActiveRoute,
    		location,
    		base,
    		routerBase,
    		registerRoute,
    		unregisterRoute,
    		$location,
    		$routes,
    		$base
    	});

    	$$self.$inject_state = $$props => {
    		if ('basepath' in $$props) $$invalidate(3, basepath = $$props.basepath);
    		if ('url' in $$props) $$invalidate(4, url = $$props.url);
    		if ('hasActiveRoute' in $$props) hasActiveRoute = $$props.hasActiveRoute;
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*$base*/ 128) {
    			// This reactive statement will update all the Routes' path when
    			// the basepath changes.
    			{
    				const { path: basepath } = $base;

    				routes.update(rs => {
    					rs.forEach(r => r.path = combinePaths(basepath, r._path));
    					return rs;
    				});
    			}
    		}

    		if ($$self.$$.dirty & /*$routes, $location*/ 96) {
    			// This reactive statement will be run when the Router is created
    			// when there are no Routes and then again the following tick, so it
    			// will not find an active Route in SSR and in the browser it will only
    			// pick an active Route after all Routes have been registered.
    			{
    				const bestMatch = pick($routes, $location.pathname);
    				activeRoute.set(bestMatch);
    			}
    		}
    	};

    	return [
    		routes,
    		location,
    		base,
    		basepath,
    		url,
    		$location,
    		$routes,
    		$base,
    		$$scope,
    		slots
    	];
    }

    class Router extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$a, create_fragment$a, safe_not_equal, { basepath: 3, url: 4 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Router",
    			options,
    			id: create_fragment$a.name
    		});
    	}

    	get basepath() {
    		throw new Error("<Router>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set basepath(value) {
    		throw new Error("<Router>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get url() {
    		throw new Error("<Router>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set url(value) {
    		throw new Error("<Router>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* node_modules/svelte-routing/src/Route.svelte generated by Svelte v3.44.1 */

    const get_default_slot_changes = dirty => ({
    	params: dirty & /*routeParams*/ 4,
    	location: dirty & /*$location*/ 16
    });

    const get_default_slot_context = ctx => ({
    	params: /*routeParams*/ ctx[2],
    	location: /*$location*/ ctx[4]
    });

    // (40:0) {#if $activeRoute !== null && $activeRoute.route === route}
    function create_if_block$5(ctx) {
    	let current_block_type_index;
    	let if_block;
    	let if_block_anchor;
    	let current;
    	const if_block_creators = [create_if_block_1$4, create_else_block$2];
    	const if_blocks = [];

    	function select_block_type(ctx, dirty) {
    		if (/*component*/ ctx[0] !== null) return 0;
    		return 1;
    	}

    	current_block_type_index = select_block_type(ctx);
    	if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

    	const block = {
    		c: function create() {
    			if_block.c();
    			if_block_anchor = empty();
    		},
    		l: function claim(nodes) {
    			if_block.l(nodes);
    			if_block_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			if_blocks[current_block_type_index].m(target, anchor);
    			insert_hydration_dev(target, if_block_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			let previous_block_index = current_block_type_index;
    			current_block_type_index = select_block_type(ctx);

    			if (current_block_type_index === previous_block_index) {
    				if_blocks[current_block_type_index].p(ctx, dirty);
    			} else {
    				group_outros();

    				transition_out(if_blocks[previous_block_index], 1, 1, () => {
    					if_blocks[previous_block_index] = null;
    				});

    				check_outros();
    				if_block = if_blocks[current_block_type_index];

    				if (!if_block) {
    					if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    					if_block.c();
    				} else {
    					if_block.p(ctx, dirty);
    				}

    				transition_in(if_block, 1);
    				if_block.m(if_block_anchor.parentNode, if_block_anchor);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if_blocks[current_block_type_index].d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$5.name,
    		type: "if",
    		source: "(40:0) {#if $activeRoute !== null && $activeRoute.route === route}",
    		ctx
    	});

    	return block;
    }

    // (43:2) {:else}
    function create_else_block$2(ctx) {
    	let current;
    	const default_slot_template = /*#slots*/ ctx[10].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[9], get_default_slot_context);

    	const block = {
    		c: function create() {
    			if (default_slot) default_slot.c();
    		},
    		l: function claim(nodes) {
    			if (default_slot) default_slot.l(nodes);
    		},
    		m: function mount(target, anchor) {
    			if (default_slot) {
    				default_slot.m(target, anchor);
    			}

    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			if (default_slot) {
    				if (default_slot.p && (!current || dirty & /*$$scope, routeParams, $location*/ 532)) {
    					update_slot_base(
    						default_slot,
    						default_slot_template,
    						ctx,
    						/*$$scope*/ ctx[9],
    						!current
    						? get_all_dirty_from_scope(/*$$scope*/ ctx[9])
    						: get_slot_changes(default_slot_template, /*$$scope*/ ctx[9], dirty, get_default_slot_changes),
    						get_default_slot_context
    					);
    				}
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(default_slot, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(default_slot, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (default_slot) default_slot.d(detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block$2.name,
    		type: "else",
    		source: "(43:2) {:else}",
    		ctx
    	});

    	return block;
    }

    // (41:2) {#if component !== null}
    function create_if_block_1$4(ctx) {
    	let switch_instance;
    	let switch_instance_anchor;
    	let current;

    	const switch_instance_spread_levels = [
    		{ location: /*$location*/ ctx[4] },
    		/*routeParams*/ ctx[2],
    		/*routeProps*/ ctx[3]
    	];

    	var switch_value = /*component*/ ctx[0];

    	function switch_props(ctx) {
    		let switch_instance_props = {};

    		for (let i = 0; i < switch_instance_spread_levels.length; i += 1) {
    			switch_instance_props = assign(switch_instance_props, switch_instance_spread_levels[i]);
    		}

    		return {
    			props: switch_instance_props,
    			$$inline: true
    		};
    	}

    	if (switch_value) {
    		switch_instance = new switch_value(switch_props());
    	}

    	const block = {
    		c: function create() {
    			if (switch_instance) create_component(switch_instance.$$.fragment);
    			switch_instance_anchor = empty();
    		},
    		l: function claim(nodes) {
    			if (switch_instance) claim_component(switch_instance.$$.fragment, nodes);
    			switch_instance_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			if (switch_instance) {
    				mount_component(switch_instance, target, anchor);
    			}

    			insert_hydration_dev(target, switch_instance_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const switch_instance_changes = (dirty & /*$location, routeParams, routeProps*/ 28)
    			? get_spread_update(switch_instance_spread_levels, [
    					dirty & /*$location*/ 16 && { location: /*$location*/ ctx[4] },
    					dirty & /*routeParams*/ 4 && get_spread_object(/*routeParams*/ ctx[2]),
    					dirty & /*routeProps*/ 8 && get_spread_object(/*routeProps*/ ctx[3])
    				])
    			: {};

    			if (switch_value !== (switch_value = /*component*/ ctx[0])) {
    				if (switch_instance) {
    					group_outros();
    					const old_component = switch_instance;

    					transition_out(old_component.$$.fragment, 1, 0, () => {
    						destroy_component(old_component, 1);
    					});

    					check_outros();
    				}

    				if (switch_value) {
    					switch_instance = new switch_value(switch_props());
    					create_component(switch_instance.$$.fragment);
    					transition_in(switch_instance.$$.fragment, 1);
    					mount_component(switch_instance, switch_instance_anchor.parentNode, switch_instance_anchor);
    				} else {
    					switch_instance = null;
    				}
    			} else if (switch_value) {
    				switch_instance.$set(switch_instance_changes);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			if (switch_instance) transition_in(switch_instance.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			if (switch_instance) transition_out(switch_instance.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(switch_instance_anchor);
    			if (switch_instance) destroy_component(switch_instance, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1$4.name,
    		type: "if",
    		source: "(41:2) {#if component !== null}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$9(ctx) {
    	let if_block_anchor;
    	let current;
    	let if_block = /*$activeRoute*/ ctx[1] !== null && /*$activeRoute*/ ctx[1].route === /*route*/ ctx[7] && create_if_block$5(ctx);

    	const block = {
    		c: function create() {
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    		},
    		l: function claim(nodes) {
    			if (if_block) if_block.l(nodes);
    			if_block_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			if (if_block) if_block.m(target, anchor);
    			insert_hydration_dev(target, if_block_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (/*$activeRoute*/ ctx[1] !== null && /*$activeRoute*/ ctx[1].route === /*route*/ ctx[7]) {
    				if (if_block) {
    					if_block.p(ctx, dirty);

    					if (dirty & /*$activeRoute*/ 2) {
    						transition_in(if_block, 1);
    					}
    				} else {
    					if_block = create_if_block$5(ctx);
    					if_block.c();
    					transition_in(if_block, 1);
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			} else if (if_block) {
    				group_outros();

    				transition_out(if_block, 1, 1, () => {
    					if_block = null;
    				});

    				check_outros();
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$9.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$9($$self, $$props, $$invalidate) {
    	let $activeRoute;
    	let $location;
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Route', slots, ['default']);
    	let { path = "" } = $$props;
    	let { component = null } = $$props;
    	const { registerRoute, unregisterRoute, activeRoute } = getContext(ROUTER);
    	validate_store(activeRoute, 'activeRoute');
    	component_subscribe($$self, activeRoute, value => $$invalidate(1, $activeRoute = value));
    	const location = getContext(LOCATION);
    	validate_store(location, 'location');
    	component_subscribe($$self, location, value => $$invalidate(4, $location = value));

    	const route = {
    		path,
    		// If no path prop is given, this Route will act as the default Route
    		// that is rendered if no other Route in the Router is a match.
    		default: path === ""
    	};

    	let routeParams = {};
    	let routeProps = {};
    	registerRoute(route);

    	// There is no need to unregister Routes in SSR since it will all be
    	// thrown away anyway.
    	if (typeof window !== "undefined") {
    		onDestroy(() => {
    			unregisterRoute(route);
    		});
    	}

    	$$self.$$set = $$new_props => {
    		$$invalidate(13, $$props = assign(assign({}, $$props), exclude_internal_props($$new_props)));
    		if ('path' in $$new_props) $$invalidate(8, path = $$new_props.path);
    		if ('component' in $$new_props) $$invalidate(0, component = $$new_props.component);
    		if ('$$scope' in $$new_props) $$invalidate(9, $$scope = $$new_props.$$scope);
    	};

    	$$self.$capture_state = () => ({
    		getContext,
    		onDestroy,
    		ROUTER,
    		LOCATION,
    		path,
    		component,
    		registerRoute,
    		unregisterRoute,
    		activeRoute,
    		location,
    		route,
    		routeParams,
    		routeProps,
    		$activeRoute,
    		$location
    	});

    	$$self.$inject_state = $$new_props => {
    		$$invalidate(13, $$props = assign(assign({}, $$props), $$new_props));
    		if ('path' in $$props) $$invalidate(8, path = $$new_props.path);
    		if ('component' in $$props) $$invalidate(0, component = $$new_props.component);
    		if ('routeParams' in $$props) $$invalidate(2, routeParams = $$new_props.routeParams);
    		if ('routeProps' in $$props) $$invalidate(3, routeProps = $$new_props.routeProps);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*$activeRoute*/ 2) {
    			if ($activeRoute && $activeRoute.route === route) {
    				$$invalidate(2, routeParams = $activeRoute.params);
    			}
    		}

    		{
    			const { path, component, ...rest } = $$props;
    			$$invalidate(3, routeProps = rest);
    		}
    	};

    	$$props = exclude_internal_props($$props);

    	return [
    		component,
    		$activeRoute,
    		routeParams,
    		routeProps,
    		$location,
    		activeRoute,
    		location,
    		route,
    		path,
    		$$scope,
    		slots
    	];
    }

    class Route extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$9, create_fragment$9, safe_not_equal, { path: 8, component: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Route",
    			options,
    			id: create_fragment$9.name
    		});
    	}

    	get path() {
    		throw new Error("<Route>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set path(value) {
    		throw new Error("<Route>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get component() {
    		throw new Error("<Route>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set component(value) {
    		throw new Error("<Route>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /**
     * A link action that can be added to <a href=""> tags rather
     * than using the <Link> component.
     *
     * Example:
     * ```html
     * <a href="/post/{postId}" use:link>{post.title}</a>
     * ```
     */
    function link(node) {
      function onClick(event) {
        const anchor = event.currentTarget;

        if (
          anchor.target === "" &&
          hostMatches(anchor) &&
          shouldNavigate(event)
        ) {
          event.preventDefault();
          navigate(anchor.pathname + anchor.search, { replace: anchor.hasAttribute("replace") });
        }
      }

      node.addEventListener("click", onClick);

      return {
        destroy() {
          node.removeEventListener("click", onClick);
        }
      };
    }

    const collection = writable("");
    const document$1 = writable("");
    const title = derived([collection, document$1], ([$collection, $document]) => {
        if ($document !== "") {
            return `${$collection} - ${$document}`;
        }
        else {
            return $collection;
        }
    });

    /* src/components/Navbar.svelte generated by Svelte v3.44.1 */
    const file$8 = "src/components/Navbar.svelte";

    function get_each_context$5(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[6] = list[i];
    	return child_ctx;
    }

    // (48:4) {:else}
    function create_else_block$1(ctx) {
    	let ion_title;
    	let t0;
    	let t1;
    	let ion_buttons;
    	let each_value = /*menuItems*/ ctx[3];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block$5(get_each_context$5(ctx, each_value, i));
    	}

    	const block = {
    		c: function create() {
    			ion_title = element("ion-title");
    			t0 = text(/*$title*/ ctx[1]);
    			t1 = space();
    			ion_buttons = element("ion-buttons");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			this.h();
    		},
    		l: function claim(nodes) {
    			ion_title = claim_element(nodes, "ION-TITLE", {});
    			var ion_title_nodes = children(ion_title);
    			t0 = claim_text(ion_title_nodes, /*$title*/ ctx[1]);
    			ion_title_nodes.forEach(detach_dev);
    			t1 = claim_space(nodes);
    			ion_buttons = claim_element(nodes, "ION-BUTTONS", { slot: true });
    			var ion_buttons_nodes = children(ion_buttons);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].l(ion_buttons_nodes);
    			}

    			ion_buttons_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			add_location(ion_title, file$8, 48, 6, 912);
    			set_custom_element_data(ion_buttons, "slot", "end");
    			add_location(ion_buttons, file$8, 52, 6, 967);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, ion_title, anchor);
    			append_hydration_dev(ion_title, t0);
    			insert_hydration_dev(target, t1, anchor);
    			insert_hydration_dev(target, ion_buttons, anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(ion_buttons, null);
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*$title*/ 2) set_data_dev(t0, /*$title*/ ctx[1]);

    			if (dirty & /*navigate, menuItems*/ 8) {
    				each_value = /*menuItems*/ ctx[3];
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context$5(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block$5(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(ion_buttons, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(ion_title);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(ion_buttons);
    			destroy_each(each_blocks, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block$1.name,
    		type: "else",
    		source: "(48:4) {:else}",
    		ctx
    	});

    	return block;
    }

    // (38:4) {#if $document !== ""}
    function create_if_block$4(ctx) {
    	let ion_title;
    	let t0;
    	let t1;
    	let ion_buttons;
    	let ion_button;
    	let ion_icon;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			ion_title = element("ion-title");
    			t0 = text(/*$title*/ ctx[1]);
    			t1 = space();
    			ion_buttons = element("ion-buttons");
    			ion_button = element("ion-button");
    			ion_icon = element("ion-icon");
    			this.h();
    		},
    		l: function claim(nodes) {
    			ion_title = claim_element(nodes, "ION-TITLE", {});
    			var ion_title_nodes = children(ion_title);
    			t0 = claim_text(ion_title_nodes, /*$title*/ ctx[1]);
    			ion_title_nodes.forEach(detach_dev);
    			t1 = claim_space(nodes);
    			ion_buttons = claim_element(nodes, "ION-BUTTONS", { slot: true });
    			var ion_buttons_nodes = children(ion_buttons);
    			ion_button = claim_element(ion_buttons_nodes, "ION-BUTTON", {});
    			var ion_button_nodes = children(ion_button);
    			ion_icon = claim_element(ion_button_nodes, "ION-ICON", { name: true });
    			children(ion_icon).forEach(detach_dev);
    			ion_button_nodes.forEach(detach_dev);
    			ion_buttons_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			add_location(ion_title, file$8, 38, 6, 688);
    			set_custom_element_data(ion_icon, "name", "close");
    			add_location(ion_icon, file$8, 44, 10, 816);
    			add_location(ion_button, file$8, 43, 8, 776);
    			set_custom_element_data(ion_buttons, "slot", "end");
    			add_location(ion_buttons, file$8, 42, 6, 743);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, ion_title, anchor);
    			append_hydration_dev(ion_title, t0);
    			insert_hydration_dev(target, t1, anchor);
    			insert_hydration_dev(target, ion_buttons, anchor);
    			append_hydration_dev(ion_buttons, ion_button);
    			append_hydration_dev(ion_button, ion_icon);

    			if (!mounted) {
    				dispose = listen_dev(ion_button, "click", /*close*/ ctx[2], false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*$title*/ 2) set_data_dev(t0, /*$title*/ ctx[1]);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(ion_title);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(ion_buttons);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$4.name,
    		type: "if",
    		source: "(38:4) {#if $document !== \\\"\\\"}",
    		ctx
    	});

    	return block;
    }

    // (54:8) {#each menuItems as item}
    function create_each_block$5(ctx) {
    	let ion_button;
    	let ion_text;
    	let t0_value = /*item*/ ctx[6].title + "";
    	let t0;
    	let t1;
    	let mounted;
    	let dispose;

    	function click_handler() {
    		return /*click_handler*/ ctx[4](/*item*/ ctx[6]);
    	}

    	const block = {
    		c: function create() {
    			ion_button = element("ion-button");
    			ion_text = element("ion-text");
    			t0 = text(t0_value);
    			t1 = space();
    			this.h();
    		},
    		l: function claim(nodes) {
    			ion_button = claim_element(nodes, "ION-BUTTON", {});
    			var ion_button_nodes = children(ion_button);
    			ion_text = claim_element(ion_button_nodes, "ION-TEXT", {});
    			var ion_text_nodes = children(ion_text);
    			t0 = claim_text(ion_text_nodes, t0_value);
    			ion_text_nodes.forEach(detach_dev);
    			t1 = claim_space(ion_button_nodes);
    			ion_button_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			add_location(ion_text, file$8, 55, 12, 1098);
    			add_location(ion_button, file$8, 54, 10, 1036);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, ion_button, anchor);
    			append_hydration_dev(ion_button, ion_text);
    			append_hydration_dev(ion_text, t0);
    			append_hydration_dev(ion_button, t1);

    			if (!mounted) {
    				dispose = listen_dev(ion_button, "click", click_handler, false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(ion_button);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block$5.name,
    		type: "each",
    		source: "(54:8) {#each menuItems as item}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$8(ctx) {
    	let ion_header;
    	let ion_toolbar;

    	function select_block_type(ctx, dirty) {
    		if (/*$document*/ ctx[0] !== "") return create_if_block$4;
    		return create_else_block$1;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block = current_block_type(ctx);

    	const block = {
    		c: function create() {
    			ion_header = element("ion-header");
    			ion_toolbar = element("ion-toolbar");
    			if_block.c();
    			this.h();
    		},
    		l: function claim(nodes) {
    			ion_header = claim_element(nodes, "ION-HEADER", {});
    			var ion_header_nodes = children(ion_header);
    			ion_toolbar = claim_element(ion_header_nodes, "ION-TOOLBAR", {});
    			var ion_toolbar_nodes = children(ion_toolbar);
    			if_block.l(ion_toolbar_nodes);
    			ion_toolbar_nodes.forEach(detach_dev);
    			ion_header_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			add_location(ion_toolbar, file$8, 36, 2, 641);
    			add_location(ion_header, file$8, 35, 0, 626);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, ion_header, anchor);
    			append_hydration_dev(ion_header, ion_toolbar);
    			if_block.m(ion_toolbar, null);
    		},
    		p: function update(ctx, [dirty]) {
    			if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block) {
    				if_block.p(ctx, dirty);
    			} else {
    				if_block.d(1);
    				if_block = current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					if_block.m(ion_toolbar, null);
    				}
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(ion_header);
    			if_block.d();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$8.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$8($$self, $$props, $$invalidate) {
    	let $collection;
    	let $document;
    	let $title;
    	validate_store(collection, 'collection');
    	component_subscribe($$self, collection, $$value => $$invalidate(5, $collection = $$value));
    	validate_store(document$1, 'document');
    	component_subscribe($$self, document$1, $$value => $$invalidate(0, $document = $$value));
    	validate_store(title, 'title');
    	component_subscribe($$self, title, $$value => $$invalidate(1, $title = $$value));
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Navbar', slots, []);

    	const close = () => {
    		if ($collection !== "") {
    			navigate($collection.toLowerCase().replaceAll(" ", "-"));
    		} else {
    			navigate("/");
    		}
    	};

    	const menuItems = [
    		{ title: "Home", href: "/" },
    		{ title: "Zen", href: "zen" },
    		{ title: "Dad Jokes", href: "dad-jokes" },
    		{ title: "Blog", href: "blog" },
    		{ title: "Recipes", href: "recipes" }
    	];

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Navbar> was created with unknown prop '${key}'`);
    	});

    	const click_handler = item => navigate(item.href);

    	$$self.$capture_state = () => ({
    		navigate,
    		title,
    		collection,
    		document: document$1,
    		close,
    		menuItems,
    		$collection,
    		$document,
    		$title
    	});

    	return [$document, $title, close, menuItems, click_handler];
    }

    class Navbar extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$8, create_fragment$8, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Navbar",
    			options,
    			id: create_fragment$8.name
    		});
    	}
    }

    function fade(node, { delay = 0, duration = 400, easing = identity } = {}) {
        const o = +getComputedStyle(node).opacity;
        return {
            delay,
            duration,
            easing,
            css: t => `opacity: ${t * o}`
        };
    }

    const previousScrollTop = writable(0);
    const currentScrollTop = writable(0);
    const previousPath = writable("");
    const currentPath = writable("");

    /* src/components/Content.svelte generated by Svelte v3.44.1 */

    const file$7 = "src/components/Content.svelte";

    function create_fragment$7(ctx) {
    	let ion_content;
    	let current;
    	const default_slot_template = /*#slots*/ ctx[2].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[1], null);

    	const block = {
    		c: function create() {
    			ion_content = element("ion-content");
    			if (default_slot) default_slot.c();
    			this.h();
    		},
    		l: function claim(nodes) {
    			ion_content = claim_element(nodes, "ION-CONTENT", {});
    			var ion_content_nodes = children(ion_content);
    			if (default_slot) default_slot.l(ion_content_nodes);
    			ion_content_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			add_location(ion_content, file$7, 35, 0, 903);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, ion_content, anchor);

    			if (default_slot) {
    				default_slot.m(ion_content, null);
    			}

    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (default_slot) {
    				if (default_slot.p && (!current || dirty & /*$$scope*/ 2)) {
    					update_slot_base(
    						default_slot,
    						default_slot_template,
    						ctx,
    						/*$$scope*/ ctx[1],
    						!current
    						? get_all_dirty_from_scope(/*$$scope*/ ctx[1])
    						: get_slot_changes(default_slot_template, /*$$scope*/ ctx[1], dirty, null),
    						null
    					);
    				}
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(default_slot, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(default_slot, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(ion_content);
    			if (default_slot) default_slot.d(detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$7.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$7($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Content', slots, ['default']);
    	let startScrollTop = 0;
    	let content;

    	const gotoStartScrollTop = () => {
    		if (content) {
    			content.scrollToPoint(0, startScrollTop, 0);
    		}
    	};

    	const saveScrollTop = ev => {
    		currentScrollTop.set(ev.detail.scrollTop);
    	};

    	onMount(() => {
    		content = document.querySelector('ion-content');
    		content.scrollEvents = true;
    		content.addEventListener('ionScroll', saveScrollTop);

    		if (window.location.pathname === get_store_value(previousPath)) {
    			startScrollTop = get_store_value(previousScrollTop);
    			gotoStartScrollTop();
    		}

    		previousScrollTop.set(get_store_value(currentScrollTop));
    		previousPath.set(get_store_value(currentPath));
    		currentPath.set(window.location.pathname);
    	});

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Content> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('$$scope' in $$props) $$invalidate(1, $$scope = $$props.$$scope);
    	};

    	$$self.$capture_state = () => ({
    		onMount,
    		get: get_store_value,
    		currentScrollTop,
    		previousScrollTop,
    		currentPath,
    		previousPath,
    		startScrollTop,
    		content,
    		gotoStartScrollTop,
    		saveScrollTop
    	});

    	$$self.$inject_state = $$props => {
    		if ('startScrollTop' in $$props) startScrollTop = $$props.startScrollTop;
    		if ('content' in $$props) content = $$props.content;
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [gotoStartScrollTop, $$scope, slots];
    }

    class Content extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$7, create_fragment$7, safe_not_equal, { gotoStartScrollTop: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Content",
    			options,
    			id: create_fragment$7.name
    		});
    	}

    	get gotoStartScrollTop() {
    		return this.$$.ctx[0];
    	}

    	set gotoStartScrollTop(value) {
    		throw new Error("<Content>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    function createCommonjsModule(fn) {
      var module = { exports: {} };
    	return fn(module, module.exports), module.exports;
    }

    /**
     * cssfilter
     *
     * @author 老雷<leizongmin@gmail.com>
     */
    function getDefaultWhiteList$1 () {
      // 白名单值说明：
      // true: 允许该属性
      // Function: function (val) { } 返回true表示允许该属性，其他值均表示不允许
      // RegExp: regexp.test(val) 返回true表示允许该属性，其他值均表示不允许
      // 除上面列出的值外均表示不允许
      var whiteList = {};

      whiteList['align-content'] = false; // default: auto
      whiteList['align-items'] = false; // default: auto
      whiteList['align-self'] = false; // default: auto
      whiteList['alignment-adjust'] = false; // default: auto
      whiteList['alignment-baseline'] = false; // default: baseline
      whiteList['all'] = false; // default: depending on individual properties
      whiteList['anchor-point'] = false; // default: none
      whiteList['animation'] = false; // default: depending on individual properties
      whiteList['animation-delay'] = false; // default: 0
      whiteList['animation-direction'] = false; // default: normal
      whiteList['animation-duration'] = false; // default: 0
      whiteList['animation-fill-mode'] = false; // default: none
      whiteList['animation-iteration-count'] = false; // default: 1
      whiteList['animation-name'] = false; // default: none
      whiteList['animation-play-state'] = false; // default: running
      whiteList['animation-timing-function'] = false; // default: ease
      whiteList['azimuth'] = false; // default: center
      whiteList['backface-visibility'] = false; // default: visible
      whiteList['background'] = true; // default: depending on individual properties
      whiteList['background-attachment'] = true; // default: scroll
      whiteList['background-clip'] = true; // default: border-box
      whiteList['background-color'] = true; // default: transparent
      whiteList['background-image'] = true; // default: none
      whiteList['background-origin'] = true; // default: padding-box
      whiteList['background-position'] = true; // default: 0% 0%
      whiteList['background-repeat'] = true; // default: repeat
      whiteList['background-size'] = true; // default: auto
      whiteList['baseline-shift'] = false; // default: baseline
      whiteList['binding'] = false; // default: none
      whiteList['bleed'] = false; // default: 6pt
      whiteList['bookmark-label'] = false; // default: content()
      whiteList['bookmark-level'] = false; // default: none
      whiteList['bookmark-state'] = false; // default: open
      whiteList['border'] = true; // default: depending on individual properties
      whiteList['border-bottom'] = true; // default: depending on individual properties
      whiteList['border-bottom-color'] = true; // default: current color
      whiteList['border-bottom-left-radius'] = true; // default: 0
      whiteList['border-bottom-right-radius'] = true; // default: 0
      whiteList['border-bottom-style'] = true; // default: none
      whiteList['border-bottom-width'] = true; // default: medium
      whiteList['border-collapse'] = true; // default: separate
      whiteList['border-color'] = true; // default: depending on individual properties
      whiteList['border-image'] = true; // default: none
      whiteList['border-image-outset'] = true; // default: 0
      whiteList['border-image-repeat'] = true; // default: stretch
      whiteList['border-image-slice'] = true; // default: 100%
      whiteList['border-image-source'] = true; // default: none
      whiteList['border-image-width'] = true; // default: 1
      whiteList['border-left'] = true; // default: depending on individual properties
      whiteList['border-left-color'] = true; // default: current color
      whiteList['border-left-style'] = true; // default: none
      whiteList['border-left-width'] = true; // default: medium
      whiteList['border-radius'] = true; // default: 0
      whiteList['border-right'] = true; // default: depending on individual properties
      whiteList['border-right-color'] = true; // default: current color
      whiteList['border-right-style'] = true; // default: none
      whiteList['border-right-width'] = true; // default: medium
      whiteList['border-spacing'] = true; // default: 0
      whiteList['border-style'] = true; // default: depending on individual properties
      whiteList['border-top'] = true; // default: depending on individual properties
      whiteList['border-top-color'] = true; // default: current color
      whiteList['border-top-left-radius'] = true; // default: 0
      whiteList['border-top-right-radius'] = true; // default: 0
      whiteList['border-top-style'] = true; // default: none
      whiteList['border-top-width'] = true; // default: medium
      whiteList['border-width'] = true; // default: depending on individual properties
      whiteList['bottom'] = false; // default: auto
      whiteList['box-decoration-break'] = true; // default: slice
      whiteList['box-shadow'] = true; // default: none
      whiteList['box-sizing'] = true; // default: content-box
      whiteList['box-snap'] = true; // default: none
      whiteList['box-suppress'] = true; // default: show
      whiteList['break-after'] = true; // default: auto
      whiteList['break-before'] = true; // default: auto
      whiteList['break-inside'] = true; // default: auto
      whiteList['caption-side'] = false; // default: top
      whiteList['chains'] = false; // default: none
      whiteList['clear'] = true; // default: none
      whiteList['clip'] = false; // default: auto
      whiteList['clip-path'] = false; // default: none
      whiteList['clip-rule'] = false; // default: nonzero
      whiteList['color'] = true; // default: implementation dependent
      whiteList['color-interpolation-filters'] = true; // default: auto
      whiteList['column-count'] = false; // default: auto
      whiteList['column-fill'] = false; // default: balance
      whiteList['column-gap'] = false; // default: normal
      whiteList['column-rule'] = false; // default: depending on individual properties
      whiteList['column-rule-color'] = false; // default: current color
      whiteList['column-rule-style'] = false; // default: medium
      whiteList['column-rule-width'] = false; // default: medium
      whiteList['column-span'] = false; // default: none
      whiteList['column-width'] = false; // default: auto
      whiteList['columns'] = false; // default: depending on individual properties
      whiteList['contain'] = false; // default: none
      whiteList['content'] = false; // default: normal
      whiteList['counter-increment'] = false; // default: none
      whiteList['counter-reset'] = false; // default: none
      whiteList['counter-set'] = false; // default: none
      whiteList['crop'] = false; // default: auto
      whiteList['cue'] = false; // default: depending on individual properties
      whiteList['cue-after'] = false; // default: none
      whiteList['cue-before'] = false; // default: none
      whiteList['cursor'] = false; // default: auto
      whiteList['direction'] = false; // default: ltr
      whiteList['display'] = true; // default: depending on individual properties
      whiteList['display-inside'] = true; // default: auto
      whiteList['display-list'] = true; // default: none
      whiteList['display-outside'] = true; // default: inline-level
      whiteList['dominant-baseline'] = false; // default: auto
      whiteList['elevation'] = false; // default: level
      whiteList['empty-cells'] = false; // default: show
      whiteList['filter'] = false; // default: none
      whiteList['flex'] = false; // default: depending on individual properties
      whiteList['flex-basis'] = false; // default: auto
      whiteList['flex-direction'] = false; // default: row
      whiteList['flex-flow'] = false; // default: depending on individual properties
      whiteList['flex-grow'] = false; // default: 0
      whiteList['flex-shrink'] = false; // default: 1
      whiteList['flex-wrap'] = false; // default: nowrap
      whiteList['float'] = false; // default: none
      whiteList['float-offset'] = false; // default: 0 0
      whiteList['flood-color'] = false; // default: black
      whiteList['flood-opacity'] = false; // default: 1
      whiteList['flow-from'] = false; // default: none
      whiteList['flow-into'] = false; // default: none
      whiteList['font'] = true; // default: depending on individual properties
      whiteList['font-family'] = true; // default: implementation dependent
      whiteList['font-feature-settings'] = true; // default: normal
      whiteList['font-kerning'] = true; // default: auto
      whiteList['font-language-override'] = true; // default: normal
      whiteList['font-size'] = true; // default: medium
      whiteList['font-size-adjust'] = true; // default: none
      whiteList['font-stretch'] = true; // default: normal
      whiteList['font-style'] = true; // default: normal
      whiteList['font-synthesis'] = true; // default: weight style
      whiteList['font-variant'] = true; // default: normal
      whiteList['font-variant-alternates'] = true; // default: normal
      whiteList['font-variant-caps'] = true; // default: normal
      whiteList['font-variant-east-asian'] = true; // default: normal
      whiteList['font-variant-ligatures'] = true; // default: normal
      whiteList['font-variant-numeric'] = true; // default: normal
      whiteList['font-variant-position'] = true; // default: normal
      whiteList['font-weight'] = true; // default: normal
      whiteList['grid'] = false; // default: depending on individual properties
      whiteList['grid-area'] = false; // default: depending on individual properties
      whiteList['grid-auto-columns'] = false; // default: auto
      whiteList['grid-auto-flow'] = false; // default: none
      whiteList['grid-auto-rows'] = false; // default: auto
      whiteList['grid-column'] = false; // default: depending on individual properties
      whiteList['grid-column-end'] = false; // default: auto
      whiteList['grid-column-start'] = false; // default: auto
      whiteList['grid-row'] = false; // default: depending on individual properties
      whiteList['grid-row-end'] = false; // default: auto
      whiteList['grid-row-start'] = false; // default: auto
      whiteList['grid-template'] = false; // default: depending on individual properties
      whiteList['grid-template-areas'] = false; // default: none
      whiteList['grid-template-columns'] = false; // default: none
      whiteList['grid-template-rows'] = false; // default: none
      whiteList['hanging-punctuation'] = false; // default: none
      whiteList['height'] = true; // default: auto
      whiteList['hyphens'] = false; // default: manual
      whiteList['icon'] = false; // default: auto
      whiteList['image-orientation'] = false; // default: auto
      whiteList['image-resolution'] = false; // default: normal
      whiteList['ime-mode'] = false; // default: auto
      whiteList['initial-letters'] = false; // default: normal
      whiteList['inline-box-align'] = false; // default: last
      whiteList['justify-content'] = false; // default: auto
      whiteList['justify-items'] = false; // default: auto
      whiteList['justify-self'] = false; // default: auto
      whiteList['left'] = false; // default: auto
      whiteList['letter-spacing'] = true; // default: normal
      whiteList['lighting-color'] = true; // default: white
      whiteList['line-box-contain'] = false; // default: block inline replaced
      whiteList['line-break'] = false; // default: auto
      whiteList['line-grid'] = false; // default: match-parent
      whiteList['line-height'] = false; // default: normal
      whiteList['line-snap'] = false; // default: none
      whiteList['line-stacking'] = false; // default: depending on individual properties
      whiteList['line-stacking-ruby'] = false; // default: exclude-ruby
      whiteList['line-stacking-shift'] = false; // default: consider-shifts
      whiteList['line-stacking-strategy'] = false; // default: inline-line-height
      whiteList['list-style'] = true; // default: depending on individual properties
      whiteList['list-style-image'] = true; // default: none
      whiteList['list-style-position'] = true; // default: outside
      whiteList['list-style-type'] = true; // default: disc
      whiteList['margin'] = true; // default: depending on individual properties
      whiteList['margin-bottom'] = true; // default: 0
      whiteList['margin-left'] = true; // default: 0
      whiteList['margin-right'] = true; // default: 0
      whiteList['margin-top'] = true; // default: 0
      whiteList['marker-offset'] = false; // default: auto
      whiteList['marker-side'] = false; // default: list-item
      whiteList['marks'] = false; // default: none
      whiteList['mask'] = false; // default: border-box
      whiteList['mask-box'] = false; // default: see individual properties
      whiteList['mask-box-outset'] = false; // default: 0
      whiteList['mask-box-repeat'] = false; // default: stretch
      whiteList['mask-box-slice'] = false; // default: 0 fill
      whiteList['mask-box-source'] = false; // default: none
      whiteList['mask-box-width'] = false; // default: auto
      whiteList['mask-clip'] = false; // default: border-box
      whiteList['mask-image'] = false; // default: none
      whiteList['mask-origin'] = false; // default: border-box
      whiteList['mask-position'] = false; // default: center
      whiteList['mask-repeat'] = false; // default: no-repeat
      whiteList['mask-size'] = false; // default: border-box
      whiteList['mask-source-type'] = false; // default: auto
      whiteList['mask-type'] = false; // default: luminance
      whiteList['max-height'] = true; // default: none
      whiteList['max-lines'] = false; // default: none
      whiteList['max-width'] = true; // default: none
      whiteList['min-height'] = true; // default: 0
      whiteList['min-width'] = true; // default: 0
      whiteList['move-to'] = false; // default: normal
      whiteList['nav-down'] = false; // default: auto
      whiteList['nav-index'] = false; // default: auto
      whiteList['nav-left'] = false; // default: auto
      whiteList['nav-right'] = false; // default: auto
      whiteList['nav-up'] = false; // default: auto
      whiteList['object-fit'] = false; // default: fill
      whiteList['object-position'] = false; // default: 50% 50%
      whiteList['opacity'] = false; // default: 1
      whiteList['order'] = false; // default: 0
      whiteList['orphans'] = false; // default: 2
      whiteList['outline'] = false; // default: depending on individual properties
      whiteList['outline-color'] = false; // default: invert
      whiteList['outline-offset'] = false; // default: 0
      whiteList['outline-style'] = false; // default: none
      whiteList['outline-width'] = false; // default: medium
      whiteList['overflow'] = false; // default: depending on individual properties
      whiteList['overflow-wrap'] = false; // default: normal
      whiteList['overflow-x'] = false; // default: visible
      whiteList['overflow-y'] = false; // default: visible
      whiteList['padding'] = true; // default: depending on individual properties
      whiteList['padding-bottom'] = true; // default: 0
      whiteList['padding-left'] = true; // default: 0
      whiteList['padding-right'] = true; // default: 0
      whiteList['padding-top'] = true; // default: 0
      whiteList['page'] = false; // default: auto
      whiteList['page-break-after'] = false; // default: auto
      whiteList['page-break-before'] = false; // default: auto
      whiteList['page-break-inside'] = false; // default: auto
      whiteList['page-policy'] = false; // default: start
      whiteList['pause'] = false; // default: implementation dependent
      whiteList['pause-after'] = false; // default: implementation dependent
      whiteList['pause-before'] = false; // default: implementation dependent
      whiteList['perspective'] = false; // default: none
      whiteList['perspective-origin'] = false; // default: 50% 50%
      whiteList['pitch'] = false; // default: medium
      whiteList['pitch-range'] = false; // default: 50
      whiteList['play-during'] = false; // default: auto
      whiteList['position'] = false; // default: static
      whiteList['presentation-level'] = false; // default: 0
      whiteList['quotes'] = false; // default: text
      whiteList['region-fragment'] = false; // default: auto
      whiteList['resize'] = false; // default: none
      whiteList['rest'] = false; // default: depending on individual properties
      whiteList['rest-after'] = false; // default: none
      whiteList['rest-before'] = false; // default: none
      whiteList['richness'] = false; // default: 50
      whiteList['right'] = false; // default: auto
      whiteList['rotation'] = false; // default: 0
      whiteList['rotation-point'] = false; // default: 50% 50%
      whiteList['ruby-align'] = false; // default: auto
      whiteList['ruby-merge'] = false; // default: separate
      whiteList['ruby-position'] = false; // default: before
      whiteList['shape-image-threshold'] = false; // default: 0.0
      whiteList['shape-outside'] = false; // default: none
      whiteList['shape-margin'] = false; // default: 0
      whiteList['size'] = false; // default: auto
      whiteList['speak'] = false; // default: auto
      whiteList['speak-as'] = false; // default: normal
      whiteList['speak-header'] = false; // default: once
      whiteList['speak-numeral'] = false; // default: continuous
      whiteList['speak-punctuation'] = false; // default: none
      whiteList['speech-rate'] = false; // default: medium
      whiteList['stress'] = false; // default: 50
      whiteList['string-set'] = false; // default: none
      whiteList['tab-size'] = false; // default: 8
      whiteList['table-layout'] = false; // default: auto
      whiteList['text-align'] = true; // default: start
      whiteList['text-align-last'] = true; // default: auto
      whiteList['text-combine-upright'] = true; // default: none
      whiteList['text-decoration'] = true; // default: none
      whiteList['text-decoration-color'] = true; // default: currentColor
      whiteList['text-decoration-line'] = true; // default: none
      whiteList['text-decoration-skip'] = true; // default: objects
      whiteList['text-decoration-style'] = true; // default: solid
      whiteList['text-emphasis'] = true; // default: depending on individual properties
      whiteList['text-emphasis-color'] = true; // default: currentColor
      whiteList['text-emphasis-position'] = true; // default: over right
      whiteList['text-emphasis-style'] = true; // default: none
      whiteList['text-height'] = true; // default: auto
      whiteList['text-indent'] = true; // default: 0
      whiteList['text-justify'] = true; // default: auto
      whiteList['text-orientation'] = true; // default: mixed
      whiteList['text-overflow'] = true; // default: clip
      whiteList['text-shadow'] = true; // default: none
      whiteList['text-space-collapse'] = true; // default: collapse
      whiteList['text-transform'] = true; // default: none
      whiteList['text-underline-position'] = true; // default: auto
      whiteList['text-wrap'] = true; // default: normal
      whiteList['top'] = false; // default: auto
      whiteList['transform'] = false; // default: none
      whiteList['transform-origin'] = false; // default: 50% 50% 0
      whiteList['transform-style'] = false; // default: flat
      whiteList['transition'] = false; // default: depending on individual properties
      whiteList['transition-delay'] = false; // default: 0s
      whiteList['transition-duration'] = false; // default: 0s
      whiteList['transition-property'] = false; // default: all
      whiteList['transition-timing-function'] = false; // default: ease
      whiteList['unicode-bidi'] = false; // default: normal
      whiteList['vertical-align'] = false; // default: baseline
      whiteList['visibility'] = false; // default: visible
      whiteList['voice-balance'] = false; // default: center
      whiteList['voice-duration'] = false; // default: auto
      whiteList['voice-family'] = false; // default: implementation dependent
      whiteList['voice-pitch'] = false; // default: medium
      whiteList['voice-range'] = false; // default: medium
      whiteList['voice-rate'] = false; // default: normal
      whiteList['voice-stress'] = false; // default: normal
      whiteList['voice-volume'] = false; // default: medium
      whiteList['volume'] = false; // default: medium
      whiteList['white-space'] = false; // default: normal
      whiteList['widows'] = false; // default: 2
      whiteList['width'] = true; // default: auto
      whiteList['will-change'] = false; // default: auto
      whiteList['word-break'] = true; // default: normal
      whiteList['word-spacing'] = true; // default: normal
      whiteList['word-wrap'] = true; // default: normal
      whiteList['wrap-flow'] = false; // default: auto
      whiteList['wrap-through'] = false; // default: wrap
      whiteList['writing-mode'] = false; // default: horizontal-tb
      whiteList['z-index'] = false; // default: auto

      return whiteList;
    }


    /**
     * 匹配到白名单上的一个属性时
     *
     * @param {String} name
     * @param {String} value
     * @param {Object} options
     * @return {String}
     */
    function onAttr (name, value, options) {
      // do nothing
    }

    /**
     * 匹配到不在白名单上的一个属性时
     *
     * @param {String} name
     * @param {String} value
     * @param {Object} options
     * @return {String}
     */
    function onIgnoreAttr (name, value, options) {
      // do nothing
    }

    var REGEXP_URL_JAVASCRIPT = /javascript\s*\:/img;

    /**
     * 过滤属性值
     *
     * @param {String} name
     * @param {String} value
     * @return {String}
     */
    function safeAttrValue$1(name, value) {
      if (REGEXP_URL_JAVASCRIPT.test(value)) return '';
      return value;
    }


    var whiteList$1 = getDefaultWhiteList$1();
    var getDefaultWhiteList_1$1 = getDefaultWhiteList$1;
    var onAttr_1 = onAttr;
    var onIgnoreAttr_1 = onIgnoreAttr;
    var safeAttrValue_1$1 = safeAttrValue$1;

    var _default$1 = {
    	whiteList: whiteList$1,
    	getDefaultWhiteList: getDefaultWhiteList_1$1,
    	onAttr: onAttr_1,
    	onIgnoreAttr: onIgnoreAttr_1,
    	safeAttrValue: safeAttrValue_1$1
    };

    var util$1 = {
      indexOf: function (arr, item) {
        var i, j;
        if (Array.prototype.indexOf) {
          return arr.indexOf(item);
        }
        for (i = 0, j = arr.length; i < j; i++) {
          if (arr[i] === item) {
            return i;
          }
        }
        return -1;
      },
      forEach: function (arr, fn, scope) {
        var i, j;
        if (Array.prototype.forEach) {
          return arr.forEach(fn, scope);
        }
        for (i = 0, j = arr.length; i < j; i++) {
          fn.call(scope, arr[i], i, arr);
        }
      },
      trim: function (str) {
        if (String.prototype.trim) {
          return str.trim();
        }
        return str.replace(/(^\s*)|(\s*$)/g, '');
      },
      trimRight: function (str) {
        if (String.prototype.trimRight) {
          return str.trimRight();
        }
        return str.replace(/(\s*$)/g, '');
      }
    };

    /**
     * cssfilter
     *
     * @author 老雷<leizongmin@gmail.com>
     */

    /**
     * 解析style
     *
     * @param {String} css
     * @param {Function} onAttr 处理属性的函数
     *   参数格式： function (sourcePosition, position, name, value, source)
     * @return {String}
     */
    function parseStyle (css, onAttr) {
      css = util$1.trimRight(css);
      if (css[css.length - 1] !== ';') css += ';';
      var cssLength = css.length;
      var isParenthesisOpen = false;
      var lastPos = 0;
      var i = 0;
      var retCSS = '';

      function addNewAttr () {
        // 如果没有正常的闭合圆括号，则直接忽略当前属性
        if (!isParenthesisOpen) {
          var source = util$1.trim(css.slice(lastPos, i));
          var j = source.indexOf(':');
          if (j !== -1) {
            var name = util$1.trim(source.slice(0, j));
            var value = util$1.trim(source.slice(j + 1));
            // 必须有属性名称
            if (name) {
              var ret = onAttr(lastPos, retCSS.length, name, value, source);
              if (ret) retCSS += ret + '; ';
            }
          }
        }
        lastPos = i + 1;
      }

      for (; i < cssLength; i++) {
        var c = css[i];
        if (c === '/' && css[i + 1] === '*') {
          // 备注开始
          var j = css.indexOf('*/', i + 2);
          // 如果没有正常的备注结束，则后面的部分全部跳过
          if (j === -1) break;
          // 直接将当前位置调到备注结尾，并且初始化状态
          i = j + 1;
          lastPos = i + 1;
          isParenthesisOpen = false;
        } else if (c === '(') {
          isParenthesisOpen = true;
        } else if (c === ')') {
          isParenthesisOpen = false;
        } else if (c === ';') {
          if (isParenthesisOpen) ; else {
            addNewAttr();
          }
        } else if (c === '\n') {
          addNewAttr();
        }
      }

      return util$1.trim(retCSS);
    }

    var parser$1 = parseStyle;

    /**
     * cssfilter
     *
     * @author 老雷<leizongmin@gmail.com>
     */

    /**
     * 返回值是否为空
     *
     * @param {Object} obj
     * @return {Boolean}
     */
    function isNull$1 (obj) {
      return (obj === undefined || obj === null);
    }

    /**
     * 浅拷贝对象
     *
     * @param {Object} obj
     * @return {Object}
     */
    function shallowCopyObject$1 (obj) {
      var ret = {};
      for (var i in obj) {
        ret[i] = obj[i];
      }
      return ret;
    }

    /**
     * 创建CSS过滤器
     *
     * @param {Object} options
     *   - {Object} whiteList
     *   - {Function} onAttr
     *   - {Function} onIgnoreAttr
     *   - {Function} safeAttrValue
     */
    function FilterCSS$2 (options) {
      options = shallowCopyObject$1(options || {});
      options.whiteList = options.whiteList || _default$1.whiteList;
      options.onAttr = options.onAttr || _default$1.onAttr;
      options.onIgnoreAttr = options.onIgnoreAttr || _default$1.onIgnoreAttr;
      options.safeAttrValue = options.safeAttrValue || _default$1.safeAttrValue;
      this.options = options;
    }

    FilterCSS$2.prototype.process = function (css) {
      // 兼容各种奇葩输入
      css = css || '';
      css = css.toString();
      if (!css) return '';

      var me = this;
      var options = me.options;
      var whiteList = options.whiteList;
      var onAttr = options.onAttr;
      var onIgnoreAttr = options.onIgnoreAttr;
      var safeAttrValue = options.safeAttrValue;

      var retCSS = parser$1(css, function (sourcePosition, position, name, value, source) {

        var check = whiteList[name];
        var isWhite = false;
        if (check === true) isWhite = check;
        else if (typeof check === 'function') isWhite = check(value);
        else if (check instanceof RegExp) isWhite = check.test(value);
        if (isWhite !== true) isWhite = false;

        // 如果过滤后 value 为空则直接忽略
        value = safeAttrValue(name, value);
        if (!value) return;

        var opts = {
          position: position,
          sourcePosition: sourcePosition,
          source: source,
          isWhite: isWhite
        };

        if (isWhite) {

          var ret = onAttr(name, value, opts);
          if (isNull$1(ret)) {
            return name + ':' + value;
          } else {
            return ret;
          }

        } else {

          var ret = onIgnoreAttr(name, value, opts);
          if (!isNull$1(ret)) {
            return ret;
          }

        }
      });

      return retCSS;
    };


    var css = FilterCSS$2;

    /**
     * cssfilter
     *
     * @author 老雷<leizongmin@gmail.com>
     */

    var lib$1 = createCommonjsModule(function (module, exports) {
    /**
     * XSS过滤
     *
     * @param {String} css 要过滤的CSS代码
     * @param {Object} options 选项：whiteList, onAttr, onIgnoreAttr
     * @return {String}
     */
    function filterCSS (html, options) {
      var xss = new css(options);
      return xss.process(html);
    }


    // 输出
    exports = module.exports = filterCSS;
    exports.FilterCSS = css;
    for (var i in _default$1) exports[i] = _default$1[i];

    // 在浏览器端使用
    if (typeof window !== 'undefined') {
      window.filterCSS = module.exports;
    }
    });

    var util = {
      indexOf: function (arr, item) {
        var i, j;
        if (Array.prototype.indexOf) {
          return arr.indexOf(item);
        }
        for (i = 0, j = arr.length; i < j; i++) {
          if (arr[i] === item) {
            return i;
          }
        }
        return -1;
      },
      forEach: function (arr, fn, scope) {
        var i, j;
        if (Array.prototype.forEach) {
          return arr.forEach(fn, scope);
        }
        for (i = 0, j = arr.length; i < j; i++) {
          fn.call(scope, arr[i], i, arr);
        }
      },
      trim: function (str) {
        if (String.prototype.trim) {
          return str.trim();
        }
        return str.replace(/(^\s*)|(\s*$)/g, "");
      },
      spaceIndex: function (str) {
        var reg = /\s|\n|\t/;
        var match = reg.exec(str);
        return match ? match.index : -1;
      },
    };

    /**
     * default settings
     *
     * @author Zongmin Lei<leizongmin@gmail.com>
     */

    var FilterCSS$1 = lib$1.FilterCSS;
    var getDefaultCSSWhiteList = lib$1.getDefaultWhiteList;


    function getDefaultWhiteList() {
      return {
        a: ["target", "href", "title"],
        abbr: ["title"],
        address: [],
        area: ["shape", "coords", "href", "alt"],
        article: [],
        aside: [],
        audio: [
          "autoplay",
          "controls",
          "crossorigin",
          "loop",
          "muted",
          "preload",
          "src",
        ],
        b: [],
        bdi: ["dir"],
        bdo: ["dir"],
        big: [],
        blockquote: ["cite"],
        br: [],
        caption: [],
        center: [],
        cite: [],
        code: [],
        col: ["align", "valign", "span", "width"],
        colgroup: ["align", "valign", "span", "width"],
        dd: [],
        del: ["datetime"],
        details: ["open"],
        div: [],
        dl: [],
        dt: [],
        em: [],
        figcaption: [],
        figure: [],
        font: ["color", "size", "face"],
        footer: [],
        h1: [],
        h2: [],
        h3: [],
        h4: [],
        h5: [],
        h6: [],
        header: [],
        hr: [],
        i: [],
        img: ["src", "alt", "title", "width", "height"],
        ins: ["datetime"],
        li: [],
        mark: [],
        nav: [],
        ol: [],
        p: [],
        pre: [],
        s: [],
        section: [],
        small: [],
        span: [],
        sub: [],
        summary: [],
        sup: [],
        strong: [],
        strike: [],
        table: ["width", "border", "align", "valign"],
        tbody: ["align", "valign"],
        td: ["width", "rowspan", "colspan", "align", "valign"],
        tfoot: ["align", "valign"],
        th: ["width", "rowspan", "colspan", "align", "valign"],
        thead: ["align", "valign"],
        tr: ["rowspan", "align", "valign"],
        tt: [],
        u: [],
        ul: [],
        video: [
          "autoplay",
          "controls",
          "crossorigin",
          "loop",
          "muted",
          "playsinline",
          "poster",
          "preload",
          "src",
          "height",
          "width",
        ],
      };
    }

    var defaultCSSFilter = new FilterCSS$1();

    /**
     * default onTag function
     *
     * @param {String} tag
     * @param {String} html
     * @param {Object} options
     * @return {String}
     */
    function onTag(tag, html, options) {
      // do nothing
    }

    /**
     * default onIgnoreTag function
     *
     * @param {String} tag
     * @param {String} html
     * @param {Object} options
     * @return {String}
     */
    function onIgnoreTag(tag, html, options) {
      // do nothing
    }

    /**
     * default onTagAttr function
     *
     * @param {String} tag
     * @param {String} name
     * @param {String} value
     * @return {String}
     */
    function onTagAttr(tag, name, value) {
      // do nothing
    }

    /**
     * default onIgnoreTagAttr function
     *
     * @param {String} tag
     * @param {String} name
     * @param {String} value
     * @return {String}
     */
    function onIgnoreTagAttr(tag, name, value) {
      // do nothing
    }

    /**
     * default escapeHtml function
     *
     * @param {String} html
     */
    function escapeHtml(html) {
      return html.replace(REGEXP_LT, "&lt;").replace(REGEXP_GT, "&gt;");
    }

    /**
     * default safeAttrValue function
     *
     * @param {String} tag
     * @param {String} name
     * @param {String} value
     * @param {Object} cssFilter
     * @return {String}
     */
    function safeAttrValue(tag, name, value, cssFilter) {
      // unescape attribute value firstly
      value = friendlyAttrValue(value);

      if (name === "href" || name === "src") {
        // filter `href` and `src` attribute
        // only allow the value that starts with `http://` | `https://` | `mailto:` | `/` | `#`
        value = util.trim(value);
        if (value === "#") return "#";
        if (
          !(
            value.substr(0, 7) === "http://" ||
            value.substr(0, 8) === "https://" ||
            value.substr(0, 7) === "mailto:" ||
            value.substr(0, 4) === "tel:" ||
            value.substr(0, 11) === "data:image/" ||
            value.substr(0, 6) === "ftp://" ||
            value.substr(0, 2) === "./" ||
            value.substr(0, 3) === "../" ||
            value[0] === "#" ||
            value[0] === "/"
          )
        ) {
          return "";
        }
      } else if (name === "background") {
        // filter `background` attribute (maybe no use)
        // `javascript:`
        REGEXP_DEFAULT_ON_TAG_ATTR_4.lastIndex = 0;
        if (REGEXP_DEFAULT_ON_TAG_ATTR_4.test(value)) {
          return "";
        }
      } else if (name === "style") {
        // `expression()`
        REGEXP_DEFAULT_ON_TAG_ATTR_7.lastIndex = 0;
        if (REGEXP_DEFAULT_ON_TAG_ATTR_7.test(value)) {
          return "";
        }
        // `url()`
        REGEXP_DEFAULT_ON_TAG_ATTR_8.lastIndex = 0;
        if (REGEXP_DEFAULT_ON_TAG_ATTR_8.test(value)) {
          REGEXP_DEFAULT_ON_TAG_ATTR_4.lastIndex = 0;
          if (REGEXP_DEFAULT_ON_TAG_ATTR_4.test(value)) {
            return "";
          }
        }
        if (cssFilter !== false) {
          cssFilter = cssFilter || defaultCSSFilter;
          value = cssFilter.process(value);
        }
      }

      // escape `<>"` before returns
      value = escapeAttrValue(value);
      return value;
    }

    // RegExp list
    var REGEXP_LT = /</g;
    var REGEXP_GT = />/g;
    var REGEXP_QUOTE = /"/g;
    var REGEXP_QUOTE_2 = /&quot;/g;
    var REGEXP_ATTR_VALUE_1 = /&#([a-zA-Z0-9]*);?/gim;
    var REGEXP_ATTR_VALUE_COLON = /&colon;?/gim;
    var REGEXP_ATTR_VALUE_NEWLINE = /&newline;?/gim;
    var REGEXP_DEFAULT_ON_TAG_ATTR_4 =
      /((j\s*a\s*v\s*a|v\s*b|l\s*i\s*v\s*e)\s*s\s*c\s*r\s*i\s*p\s*t\s*|m\s*o\s*c\s*h\s*a)\:/gi;
    var REGEXP_DEFAULT_ON_TAG_ATTR_7 =
      /e\s*x\s*p\s*r\s*e\s*s\s*s\s*i\s*o\s*n\s*\(.*/gi;
    var REGEXP_DEFAULT_ON_TAG_ATTR_8 = /u\s*r\s*l\s*\(.*/gi;

    /**
     * escape double quote
     *
     * @param {String} str
     * @return {String} str
     */
    function escapeQuote(str) {
      return str.replace(REGEXP_QUOTE, "&quot;");
    }

    /**
     * unescape double quote
     *
     * @param {String} str
     * @return {String} str
     */
    function unescapeQuote(str) {
      return str.replace(REGEXP_QUOTE_2, '"');
    }

    /**
     * escape html entities
     *
     * @param {String} str
     * @return {String}
     */
    function escapeHtmlEntities(str) {
      return str.replace(REGEXP_ATTR_VALUE_1, function replaceUnicode(str, code) {
        return code[0] === "x" || code[0] === "X"
          ? String.fromCharCode(parseInt(code.substr(1), 16))
          : String.fromCharCode(parseInt(code, 10));
      });
    }

    /**
     * escape html5 new danger entities
     *
     * @param {String} str
     * @return {String}
     */
    function escapeDangerHtml5Entities(str) {
      return str
        .replace(REGEXP_ATTR_VALUE_COLON, ":")
        .replace(REGEXP_ATTR_VALUE_NEWLINE, " ");
    }

    /**
     * clear nonprintable characters
     *
     * @param {String} str
     * @return {String}
     */
    function clearNonPrintableCharacter(str) {
      var str2 = "";
      for (var i = 0, len = str.length; i < len; i++) {
        str2 += str.charCodeAt(i) < 32 ? " " : str.charAt(i);
      }
      return util.trim(str2);
    }

    /**
     * get friendly attribute value
     *
     * @param {String} str
     * @return {String}
     */
    function friendlyAttrValue(str) {
      str = unescapeQuote(str);
      str = escapeHtmlEntities(str);
      str = escapeDangerHtml5Entities(str);
      str = clearNonPrintableCharacter(str);
      return str;
    }

    /**
     * unescape attribute value
     *
     * @param {String} str
     * @return {String}
     */
    function escapeAttrValue(str) {
      str = escapeQuote(str);
      str = escapeHtml(str);
      return str;
    }

    /**
     * `onIgnoreTag` function for removing all the tags that are not in whitelist
     */
    function onIgnoreTagStripAll() {
      return "";
    }

    /**
     * remove tag body
     * specify a `tags` list, if the tag is not in the `tags` list then process by the specify function (optional)
     *
     * @param {array} tags
     * @param {function} next
     */
    function StripTagBody(tags, next) {
      if (typeof next !== "function") {
        next = function () {};
      }

      var isRemoveAllTag = !Array.isArray(tags);
      function isRemoveTag(tag) {
        if (isRemoveAllTag) return true;
        return util.indexOf(tags, tag) !== -1;
      }

      var removeList = [];
      var posStart = false;

      return {
        onIgnoreTag: function (tag, html, options) {
          if (isRemoveTag(tag)) {
            if (options.isClosing) {
              var ret = "[/removed]";
              var end = options.position + ret.length;
              removeList.push([
                posStart !== false ? posStart : options.position,
                end,
              ]);
              posStart = false;
              return ret;
            } else {
              if (!posStart) {
                posStart = options.position;
              }
              return "[removed]";
            }
          } else {
            return next(tag, html, options);
          }
        },
        remove: function (html) {
          var rethtml = "";
          var lastPos = 0;
          util.forEach(removeList, function (pos) {
            rethtml += html.slice(lastPos, pos[0]);
            lastPos = pos[1];
          });
          rethtml += html.slice(lastPos);
          return rethtml;
        },
      };
    }

    /**
     * remove html comments
     *
     * @param {String} html
     * @return {String}
     */
    function stripCommentTag(html) {
      var retHtml = "";
      var lastPos = 0;
      while (lastPos < html.length) {
        var i = html.indexOf("<!--", lastPos);
        if (i === -1) {
          retHtml += html.slice(lastPos);
          break;
        }
        retHtml += html.slice(lastPos, i);
        var j = html.indexOf("-->", i);
        if (j === -1) {
          break;
        }
        lastPos = j + 3;
      }
      return retHtml;
    }

    /**
     * remove invisible characters
     *
     * @param {String} html
     * @return {String}
     */
    function stripBlankChar(html) {
      var chars = html.split("");
      chars = chars.filter(function (char) {
        var c = char.charCodeAt(0);
        if (c === 127) return false;
        if (c <= 31) {
          if (c === 10 || c === 13) return true;
          return false;
        }
        return true;
      });
      return chars.join("");
    }

    var whiteList = getDefaultWhiteList();
    var getDefaultWhiteList_1 = getDefaultWhiteList;
    var onTag_1 = onTag;
    var onIgnoreTag_1 = onIgnoreTag;
    var onTagAttr_1 = onTagAttr;
    var onIgnoreTagAttr_1 = onIgnoreTagAttr;
    var safeAttrValue_1 = safeAttrValue;
    var escapeHtml_1 = escapeHtml;
    var escapeQuote_1 = escapeQuote;
    var unescapeQuote_1 = unescapeQuote;
    var escapeHtmlEntities_1 = escapeHtmlEntities;
    var escapeDangerHtml5Entities_1 = escapeDangerHtml5Entities;
    var clearNonPrintableCharacter_1 = clearNonPrintableCharacter;
    var friendlyAttrValue_1 = friendlyAttrValue;
    var escapeAttrValue_1 = escapeAttrValue;
    var onIgnoreTagStripAll_1 = onIgnoreTagStripAll;
    var StripTagBody_1 = StripTagBody;
    var stripCommentTag_1 = stripCommentTag;
    var stripBlankChar_1 = stripBlankChar;
    var cssFilter = defaultCSSFilter;
    var getDefaultCSSWhiteList_1 = getDefaultCSSWhiteList;

    var _default = {
    	whiteList: whiteList,
    	getDefaultWhiteList: getDefaultWhiteList_1,
    	onTag: onTag_1,
    	onIgnoreTag: onIgnoreTag_1,
    	onTagAttr: onTagAttr_1,
    	onIgnoreTagAttr: onIgnoreTagAttr_1,
    	safeAttrValue: safeAttrValue_1,
    	escapeHtml: escapeHtml_1,
    	escapeQuote: escapeQuote_1,
    	unescapeQuote: unescapeQuote_1,
    	escapeHtmlEntities: escapeHtmlEntities_1,
    	escapeDangerHtml5Entities: escapeDangerHtml5Entities_1,
    	clearNonPrintableCharacter: clearNonPrintableCharacter_1,
    	friendlyAttrValue: friendlyAttrValue_1,
    	escapeAttrValue: escapeAttrValue_1,
    	onIgnoreTagStripAll: onIgnoreTagStripAll_1,
    	StripTagBody: StripTagBody_1,
    	stripCommentTag: stripCommentTag_1,
    	stripBlankChar: stripBlankChar_1,
    	cssFilter: cssFilter,
    	getDefaultCSSWhiteList: getDefaultCSSWhiteList_1
    };

    /**
     * Simple HTML Parser
     *
     * @author Zongmin Lei<leizongmin@gmail.com>
     */

    /**
     * get tag name
     *
     * @param {String} html e.g. '<a hef="#">'
     * @return {String}
     */
    function getTagName(html) {
      var i = util.spaceIndex(html);
      if (i === -1) {
        var tagName = html.slice(1, -1);
      } else {
        var tagName = html.slice(1, i + 1);
      }
      tagName = util.trim(tagName).toLowerCase();
      if (tagName.slice(0, 1) === "/") tagName = tagName.slice(1);
      if (tagName.slice(-1) === "/") tagName = tagName.slice(0, -1);
      return tagName;
    }

    /**
     * is close tag?
     *
     * @param {String} html 如：'<a hef="#">'
     * @return {Boolean}
     */
    function isClosing(html) {
      return html.slice(0, 2) === "</";
    }

    /**
     * parse input html and returns processed html
     *
     * @param {String} html
     * @param {Function} onTag e.g. function (sourcePosition, position, tag, html, isClosing)
     * @param {Function} escapeHtml
     * @return {String}
     */
    function parseTag$1(html, onTag, escapeHtml) {

      var rethtml = "";
      var lastPos = 0;
      var tagStart = false;
      var quoteStart = false;
      var currentPos = 0;
      var len = html.length;
      var currentTagName = "";
      var currentHtml = "";

      chariterator: for (currentPos = 0; currentPos < len; currentPos++) {
        var c = html.charAt(currentPos);
        if (tagStart === false) {
          if (c === "<") {
            tagStart = currentPos;
            continue;
          }
        } else {
          if (quoteStart === false) {
            if (c === "<") {
              rethtml += escapeHtml(html.slice(lastPos, currentPos));
              tagStart = currentPos;
              lastPos = currentPos;
              continue;
            }
            if (c === ">") {
              rethtml += escapeHtml(html.slice(lastPos, tagStart));
              currentHtml = html.slice(tagStart, currentPos + 1);
              currentTagName = getTagName(currentHtml);
              rethtml += onTag(
                tagStart,
                rethtml.length,
                currentTagName,
                currentHtml,
                isClosing(currentHtml)
              );
              lastPos = currentPos + 1;
              tagStart = false;
              continue;
            }
            if (c === '"' || c === "'") {
              var i = 1;
              var ic = html.charAt(currentPos - i);

              while (ic.trim() === "" || ic === "=") {
                if (ic === "=") {
                  quoteStart = c;
                  continue chariterator;
                }
                ic = html.charAt(currentPos - ++i);
              }
            }
          } else {
            if (c === quoteStart) {
              quoteStart = false;
              continue;
            }
          }
        }
      }
      if (lastPos < html.length) {
        rethtml += escapeHtml(html.substr(lastPos));
      }

      return rethtml;
    }

    var REGEXP_ILLEGAL_ATTR_NAME = /[^a-zA-Z0-9_:\.\-]/gim;

    /**
     * parse input attributes and returns processed attributes
     *
     * @param {String} html e.g. `href="#" target="_blank"`
     * @param {Function} onAttr e.g. `function (name, value)`
     * @return {String}
     */
    function parseAttr$1(html, onAttr) {

      var lastPos = 0;
      var retAttrs = [];
      var tmpName = false;
      var len = html.length;

      function addAttr(name, value) {
        name = util.trim(name);
        name = name.replace(REGEXP_ILLEGAL_ATTR_NAME, "").toLowerCase();
        if (name.length < 1) return;
        var ret = onAttr(name, value || "");
        if (ret) retAttrs.push(ret);
      }

      // 逐个分析字符
      for (var i = 0; i < len; i++) {
        var c = html.charAt(i);
        var v, j;
        if (tmpName === false && c === "=") {
          tmpName = html.slice(lastPos, i);
          lastPos = i + 1;
          continue;
        }
        if (tmpName !== false) {
          if (
            i === lastPos &&
            (c === '"' || c === "'") &&
            html.charAt(i - 1) === "="
          ) {
            j = html.indexOf(c, i + 1);
            if (j === -1) {
              break;
            } else {
              v = util.trim(html.slice(lastPos + 1, j));
              addAttr(tmpName, v);
              tmpName = false;
              i = j;
              lastPos = i + 1;
              continue;
            }
          }
        }
        if (/\s|\n|\t/.test(c)) {
          html = html.replace(/\s|\n|\t/g, " ");
          if (tmpName === false) {
            j = findNextEqual(html, i);
            if (j === -1) {
              v = util.trim(html.slice(lastPos, i));
              addAttr(v);
              tmpName = false;
              lastPos = i + 1;
              continue;
            } else {
              i = j - 1;
              continue;
            }
          } else {
            j = findBeforeEqual(html, i - 1);
            if (j === -1) {
              v = util.trim(html.slice(lastPos, i));
              v = stripQuoteWrap(v);
              addAttr(tmpName, v);
              tmpName = false;
              lastPos = i + 1;
              continue;
            } else {
              continue;
            }
          }
        }
      }

      if (lastPos < html.length) {
        if (tmpName === false) {
          addAttr(html.slice(lastPos));
        } else {
          addAttr(tmpName, stripQuoteWrap(util.trim(html.slice(lastPos))));
        }
      }

      return util.trim(retAttrs.join(" "));
    }

    function findNextEqual(str, i) {
      for (; i < str.length; i++) {
        var c = str[i];
        if (c === " ") continue;
        if (c === "=") return i;
        return -1;
      }
    }

    function findBeforeEqual(str, i) {
      for (; i > 0; i--) {
        var c = str[i];
        if (c === " ") continue;
        if (c === "=") return i;
        return -1;
      }
    }

    function isQuoteWrapString(text) {
      if (
        (text[0] === '"' && text[text.length - 1] === '"') ||
        (text[0] === "'" && text[text.length - 1] === "'")
      ) {
        return true;
      } else {
        return false;
      }
    }

    function stripQuoteWrap(text) {
      if (isQuoteWrapString(text)) {
        return text.substr(1, text.length - 2);
      } else {
        return text;
      }
    }

    var parseTag_1 = parseTag$1;
    var parseAttr_1 = parseAttr$1;

    var parser = {
    	parseTag: parseTag_1,
    	parseAttr: parseAttr_1
    };

    /**
     * filter xss
     *
     * @author Zongmin Lei<leizongmin@gmail.com>
     */

    var FilterCSS = lib$1.FilterCSS;


    var parseTag = parser.parseTag;
    var parseAttr = parser.parseAttr;


    /**
     * returns `true` if the input value is `undefined` or `null`
     *
     * @param {Object} obj
     * @return {Boolean}
     */
    function isNull(obj) {
      return obj === undefined || obj === null;
    }

    /**
     * get attributes for a tag
     *
     * @param {String} html
     * @return {Object}
     *   - {String} html
     *   - {Boolean} closing
     */
    function getAttrs(html) {
      var i = util.spaceIndex(html);
      if (i === -1) {
        return {
          html: "",
          closing: html[html.length - 2] === "/",
        };
      }
      html = util.trim(html.slice(i + 1, -1));
      var isClosing = html[html.length - 1] === "/";
      if (isClosing) html = util.trim(html.slice(0, -1));
      return {
        html: html,
        closing: isClosing,
      };
    }

    /**
     * shallow copy
     *
     * @param {Object} obj
     * @return {Object}
     */
    function shallowCopyObject(obj) {
      var ret = {};
      for (var i in obj) {
        ret[i] = obj[i];
      }
      return ret;
    }

    /**
     * FilterXSS class
     *
     * @param {Object} options
     *        whiteList, onTag, onTagAttr, onIgnoreTag,
     *        onIgnoreTagAttr, safeAttrValue, escapeHtml
     *        stripIgnoreTagBody, allowCommentTag, stripBlankChar
     *        css{whiteList, onAttr, onIgnoreAttr} `css=false` means don't use `cssfilter`
     */
    function FilterXSS(options) {
      options = shallowCopyObject(options || {});

      if (options.stripIgnoreTag) {
        if (options.onIgnoreTag) {
          console.error(
            'Notes: cannot use these two options "stripIgnoreTag" and "onIgnoreTag" at the same time'
          );
        }
        options.onIgnoreTag = _default.onIgnoreTagStripAll;
      }

      options.whiteList = options.whiteList || _default.whiteList;
      options.onTag = options.onTag || _default.onTag;
      options.onTagAttr = options.onTagAttr || _default.onTagAttr;
      options.onIgnoreTag = options.onIgnoreTag || _default.onIgnoreTag;
      options.onIgnoreTagAttr = options.onIgnoreTagAttr || _default.onIgnoreTagAttr;
      options.safeAttrValue = options.safeAttrValue || _default.safeAttrValue;
      options.escapeHtml = options.escapeHtml || _default.escapeHtml;
      this.options = options;

      if (options.css === false) {
        this.cssFilter = false;
      } else {
        options.css = options.css || {};
        this.cssFilter = new FilterCSS(options.css);
      }
    }

    /**
     * start process and returns result
     *
     * @param {String} html
     * @return {String}
     */
    FilterXSS.prototype.process = function (html) {
      // compatible with the input
      html = html || "";
      html = html.toString();
      if (!html) return "";

      var me = this;
      var options = me.options;
      var whiteList = options.whiteList;
      var onTag = options.onTag;
      var onIgnoreTag = options.onIgnoreTag;
      var onTagAttr = options.onTagAttr;
      var onIgnoreTagAttr = options.onIgnoreTagAttr;
      var safeAttrValue = options.safeAttrValue;
      var escapeHtml = options.escapeHtml;
      var cssFilter = me.cssFilter;

      // remove invisible characters
      if (options.stripBlankChar) {
        html = _default.stripBlankChar(html);
      }

      // remove html comments
      if (!options.allowCommentTag) {
        html = _default.stripCommentTag(html);
      }

      // if enable stripIgnoreTagBody
      var stripIgnoreTagBody = false;
      if (options.stripIgnoreTagBody) {
        var stripIgnoreTagBody = _default.StripTagBody(
          options.stripIgnoreTagBody,
          onIgnoreTag
        );
        onIgnoreTag = stripIgnoreTagBody.onIgnoreTag;
      }

      var retHtml = parseTag(
        html,
        function (sourcePosition, position, tag, html, isClosing) {
          var info = {
            sourcePosition: sourcePosition,
            position: position,
            isClosing: isClosing,
            isWhite: whiteList.hasOwnProperty(tag),
          };

          // call `onTag()`
          var ret = onTag(tag, html, info);
          if (!isNull(ret)) return ret;

          if (info.isWhite) {
            if (info.isClosing) {
              return "</" + tag + ">";
            }

            var attrs = getAttrs(html);
            var whiteAttrList = whiteList[tag];
            var attrsHtml = parseAttr(attrs.html, function (name, value) {
              // call `onTagAttr()`
              var isWhiteAttr = util.indexOf(whiteAttrList, name) !== -1;
              var ret = onTagAttr(tag, name, value, isWhiteAttr);
              if (!isNull(ret)) return ret;

              if (isWhiteAttr) {
                // call `safeAttrValue()`
                value = safeAttrValue(tag, name, value, cssFilter);
                if (value) {
                  return name + '="' + value + '"';
                } else {
                  return name;
                }
              } else {
                // call `onIgnoreTagAttr()`
                var ret = onIgnoreTagAttr(tag, name, value, isWhiteAttr);
                if (!isNull(ret)) return ret;
                return;
              }
            });

            // build new tag html
            var html = "<" + tag;
            if (attrsHtml) html += " " + attrsHtml;
            if (attrs.closing) html += " /";
            html += ">";
            return html;
          } else {
            // call `onIgnoreTag()`
            var ret = onIgnoreTag(tag, html, info);
            if (!isNull(ret)) return ret;
            return escapeHtml(html);
          }
        },
        escapeHtml
      );

      // if enable stripIgnoreTagBody
      if (stripIgnoreTagBody) {
        retHtml = stripIgnoreTagBody.remove(retHtml);
      }

      return retHtml;
    };

    var xss = FilterXSS;

    /**
     * xss
     *
     * @author Zongmin Lei<leizongmin@gmail.com>
     */

    var lib = createCommonjsModule(function (module, exports) {
    /**
     * filter xss function
     *
     * @param {String} html
     * @param {Object} options { whiteList, onTag, onTagAttr, onIgnoreTag, onIgnoreTagAttr, safeAttrValue, escapeHtml }
     * @return {String}
     */
    function filterXSS(html, options) {
      var xss$1 = new xss(options);
      return xss$1.process(html);
    }

    exports = module.exports = filterXSS;
    exports.filterXSS = filterXSS;
    exports.FilterXSS = xss;
    for (var i in _default) exports[i] = _default[i];
    for (var i in parser) exports[i] = parser[i];

    // using `xss` on the browser, output `filterXSS` to the globals
    if (typeof window !== "undefined") {
      window.filterXSS = module.exports;
    }

    // using `xss` on the WebWorker, output `filterXSS` to the globals
    function isWorkerEnv() {
      return (
        typeof self !== "undefined" &&
        typeof DedicatedWorkerGlobalScope !== "undefined" &&
        self instanceof DedicatedWorkerGlobalScope
      );
    }
    if (isWorkerEnv()) {
      self.filterXSS = module.exports;
    }
    });

    /*
     * @license
     *
     * Copyright (c) 2011-2014, Christopher Jeffrey. (MIT Licensed)
     * https://github.com/chjj/marked
     *
     * Copyright (c) 2018-2021, Костя Третяк. (MIT Licensed)
     * https://github.com/ts-stack/markdown
     */
    class ExtendRegexp {
        constructor(regex, flags = '') {
            this.source = regex.source;
            this.flags = flags;
        }
        /**
         * Extend regular expression.
         *
         * @param groupName Regular expression for search a group name.
         * @param groupRegexp Regular expression of named group.
         */
        setGroup(groupName, groupRegexp) {
            let newRegexp = typeof groupRegexp == 'string' ? groupRegexp : groupRegexp.source;
            newRegexp = newRegexp.replace(/(^|[^\[])\^/g, '$1');
            // Extend regexp.
            this.source = this.source.replace(groupName, newRegexp);
            return this;
        }
        /**
         * Returns a result of extending a regular expression.
         */
        getRegexp() {
            return new RegExp(this.source, this.flags);
        }
    }

    /**
     * @license
     *
     * Copyright (c) 2011-2014, Christopher Jeffrey. (MIT Licensed)
     * https://github.com/chjj/marked
     *
     * Copyright (c) 2018-2021, Костя Третяк. (MIT Licensed)
     * https://github.com/ts-stack/markdown
     */
    const escapeTest = /[&<>"']/;
    const escapeReplace = /[&<>"']/g;
    const replacements = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        // tslint:disable-next-line:quotemark
        "'": '&#39;',
    };
    const escapeTestNoEncode = /[<>"']|&(?!#?\w+;)/;
    const escapeReplaceNoEncode = /[<>"']|&(?!#?\w+;)/g;
    function escape(html, encode) {
        if (encode) {
            if (escapeTest.test(html)) {
                return html.replace(escapeReplace, (ch) => replacements[ch]);
            }
        }
        else {
            if (escapeTestNoEncode.test(html)) {
                return html.replace(escapeReplaceNoEncode, (ch) => replacements[ch]);
            }
        }
        return html;
    }
    function unescape(html) {
        // Explicitly match decimal, hex, and named HTML entities
        return html.replace(/&(#(?:\d+)|(?:#x[0-9A-Fa-f]+)|(?:\w+));?/gi, function (_, n) {
            n = n.toLowerCase();
            if (n === 'colon') {
                return ':';
            }
            if (n.charAt(0) === '#') {
                return n.charAt(1) === 'x'
                    ? String.fromCharCode(parseInt(n.substring(2), 16))
                    : String.fromCharCode(+n.substring(1));
            }
            return '';
        });
    }

    /**
     * @license
     *
     * Copyright (c) 2018-2021, Костя Третяк. (MIT Licensed)
     * https://github.com/ts-stack/markdown
     */
    var TokenType;
    (function (TokenType) {
        TokenType[TokenType["space"] = 1] = "space";
        TokenType[TokenType["text"] = 2] = "text";
        TokenType[TokenType["paragraph"] = 3] = "paragraph";
        TokenType[TokenType["heading"] = 4] = "heading";
        TokenType[TokenType["listStart"] = 5] = "listStart";
        TokenType[TokenType["listEnd"] = 6] = "listEnd";
        TokenType[TokenType["looseItemStart"] = 7] = "looseItemStart";
        TokenType[TokenType["looseItemEnd"] = 8] = "looseItemEnd";
        TokenType[TokenType["listItemStart"] = 9] = "listItemStart";
        TokenType[TokenType["listItemEnd"] = 10] = "listItemEnd";
        TokenType[TokenType["blockquoteStart"] = 11] = "blockquoteStart";
        TokenType[TokenType["blockquoteEnd"] = 12] = "blockquoteEnd";
        TokenType[TokenType["code"] = 13] = "code";
        TokenType[TokenType["table"] = 14] = "table";
        TokenType[TokenType["html"] = 15] = "html";
        TokenType[TokenType["hr"] = 16] = "hr";
    })(TokenType || (TokenType = {}));
    class MarkedOptions {
        constructor() {
            this.gfm = true;
            this.tables = true;
            this.breaks = false;
            this.pedantic = false;
            this.sanitize = false;
            this.mangle = true;
            this.smartLists = false;
            this.silent = false;
            this.langPrefix = 'lang-';
            this.smartypants = false;
            this.headerPrefix = '';
            /**
             * Self-close the tags for void elements (&lt;br/&gt;, &lt;img/&gt;, etc.)
             * with a "/" as required by XHTML.
             */
            this.xhtml = false;
            /**
             * The function that will be using to escape HTML entities.
             * By default using inner helper.
             */
            this.escape = escape;
            /**
             * The function that will be using to unescape HTML entities.
             * By default using inner helper.
             */
            this.unescape = unescape;
        }
    }

    /**
     * @license
     *
     * Copyright (c) 2011-2014, Christopher Jeffrey. (MIT Licensed)
     * https://github.com/chjj/marked
     *
     * Copyright (c) 2018-2021, Костя Третяк. (MIT Licensed)
     * https://github.com/ts-stack/markdown
     */
    class Renderer {
        constructor(options) {
            this.options = options || Marked.options;
        }
        code(code, lang, escaped, meta) {
            if (this.options.highlight) {
                const out = this.options.highlight(code, lang);
                if (out != null && out !== code) {
                    escaped = true;
                    code = out;
                }
            }
            const escapedCode = (escaped ? code : this.options.escape(code, true));
            if (!lang) {
                return `\n<pre><code>${escapedCode}\n</code></pre>\n`;
            }
            const className = this.options.langPrefix + this.options.escape(lang, true);
            return `\n<pre><code class="${className}">${escapedCode}\n</code></pre>\n`;
        }
        blockquote(quote) {
            return `<blockquote>\n${quote}</blockquote>\n`;
        }
        html(html) {
            return html;
        }
        heading(text, level, raw) {
            const id = this.options.headerPrefix + raw.toLowerCase().replace(/[^\w]+/g, '-');
            return `<h${level} id="${id}">${text}</h${level}>\n`;
        }
        hr() {
            return this.options.xhtml ? '<hr/>\n' : '<hr>\n';
        }
        list(body, ordered) {
            const type = ordered ? 'ol' : 'ul';
            return `\n<${type}>\n${body}</${type}>\n`;
        }
        listitem(text) {
            return '<li>' + text + '</li>\n';
        }
        paragraph(text) {
            return '<p>' + text + '</p>\n';
        }
        table(header, body) {
            return `
<table>
<thead>
${header}</thead>
<tbody>
${body}</tbody>
</table>
`;
        }
        tablerow(content) {
            return '<tr>\n' + content + '</tr>\n';
        }
        tablecell(content, flags) {
            const type = flags.header ? 'th' : 'td';
            const tag = flags.align ? '<' + type + ' style="text-align:' + flags.align + '">' : '<' + type + '>';
            return tag + content + '</' + type + '>\n';
        }
        // *** Inline level renderer methods. ***
        strong(text) {
            return '<strong>' + text + '</strong>';
        }
        em(text) {
            return '<em>' + text + '</em>';
        }
        codespan(text) {
            return '<code>' + text + '</code>';
        }
        br() {
            return this.options.xhtml ? '<br/>' : '<br>';
        }
        del(text) {
            return '<del>' + text + '</del>';
        }
        link(href, title, text) {
            if (this.options.sanitize) {
                let prot;
                try {
                    prot = decodeURIComponent(this.options.unescape(href))
                        .replace(/[^\w:]/g, '')
                        .toLowerCase();
                }
                catch (e) {
                    return text;
                }
                if (prot.indexOf('javascript:') === 0 || prot.indexOf('vbscript:') === 0 || prot.indexOf('data:') === 0) {
                    return text;
                }
            }
            let out = '<a href="' + href + '"';
            if (title) {
                out += ' title="' + title + '"';
            }
            out += '>' + text + '</a>';
            return out;
        }
        image(href, title, text) {
            let out = '<img src="' + href + '" alt="' + text + '"';
            if (title) {
                out += ' title="' + title + '"';
            }
            out += this.options.xhtml ? '/>' : '>';
            return out;
        }
        text(text) {
            return text;
        }
    }

    /**
     * @license
     *
     * Copyright (c) 2011-2014, Christopher Jeffrey. (MIT Licensed)
     * https://github.com/chjj/marked
     *
     * Copyright (c) 2018-2021, Костя Третяк. (MIT Licensed)
     * https://github.com/ts-stack/markdown
     */
    /**
     * Inline Lexer & Compiler.
     */
    class InlineLexer {
        constructor(staticThis, links, options = Marked.options, renderer) {
            this.staticThis = staticThis;
            this.links = links;
            this.options = options;
            this.renderer = renderer || this.options.renderer || new Renderer(this.options);
            if (!this.links) {
                throw new Error(`InlineLexer requires 'links' parameter.`);
            }
            this.setRules();
        }
        /**
         * Static Lexing/Compiling Method.
         */
        static output(src, links, options) {
            const inlineLexer = new this(this, links, options);
            return inlineLexer.output(src);
        }
        static getRulesBase() {
            if (this.rulesBase) {
                return this.rulesBase;
            }
            /**
             * Inline-Level Grammar.
             */
            const base = {
                escape: /^\\([\\`*{}\[\]()#+\-.!_>])/,
                autolink: /^<([^ <>]+(@|:\/)[^ <>]+)>/,
                tag: /^<!--[\s\S]*?-->|^<\/?\w+(?:"[^"]*"|'[^']*'|[^<'">])*?>/,
                link: /^!?\[(inside)\]\(href\)/,
                reflink: /^!?\[(inside)\]\s*\[([^\]]*)\]/,
                nolink: /^!?\[((?:\[[^\]]*\]|[^\[\]])*)\]/,
                strong: /^__([\s\S]+?)__(?!_)|^\*\*([\s\S]+?)\*\*(?!\*)/,
                em: /^\b_((?:[^_]|__)+?)_\b|^\*((?:\*\*|[\s\S])+?)\*(?!\*)/,
                code: /^(`+)([\s\S]*?[^`])\1(?!`)/,
                br: /^ {2,}\n(?!\s*$)/,
                text: /^[\s\S]+?(?=[\\<!\[_*`]| {2,}\n|$)/,
                _inside: /(?:\[[^\]]*\]|[^\[\]]|\](?=[^\[]*\]))*/,
                _href: /\s*<?([\s\S]*?)>?(?:\s+['"]([\s\S]*?)['"])?\s*/,
            };
            base.link = new ExtendRegexp(base.link).setGroup('inside', base._inside).setGroup('href', base._href).getRegexp();
            base.reflink = new ExtendRegexp(base.reflink).setGroup('inside', base._inside).getRegexp();
            return (this.rulesBase = base);
        }
        static getRulesPedantic() {
            if (this.rulesPedantic) {
                return this.rulesPedantic;
            }
            return (this.rulesPedantic = Object.assign(Object.assign({}, this.getRulesBase()), {
                strong: /^__(?=\S)([\s\S]*?\S)__(?!_)|^\*\*(?=\S)([\s\S]*?\S)\*\*(?!\*)/,
                em: /^_(?=\S)([\s\S]*?\S)_(?!_)|^\*(?=\S)([\s\S]*?\S)\*(?!\*)/,
            }));
        }
        static getRulesGfm() {
            if (this.rulesGfm) {
                return this.rulesGfm;
            }
            const base = this.getRulesBase();
            const escape = new ExtendRegexp(base.escape).setGroup('])', '~|])').getRegexp();
            const text = new ExtendRegexp(base.text).setGroup(']|', '~]|').setGroup('|', '|https?://|').getRegexp();
            return (this.rulesGfm = Object.assign(Object.assign({}, base), {
                escape,
                url: /^(https?:\/\/[^\s<]+[^<.,:;"')\]\s])/,
                del: /^~~(?=\S)([\s\S]*?\S)~~/,
                text,
            }));
        }
        static getRulesBreaks() {
            if (this.rulesBreaks) {
                return this.rulesBreaks;
            }
            const inline = this.getRulesGfm();
            const gfm = this.getRulesGfm();
            return (this.rulesBreaks = Object.assign(Object.assign({}, gfm), {
                br: new ExtendRegexp(inline.br).setGroup('{2,}', '*').getRegexp(),
                text: new ExtendRegexp(gfm.text).setGroup('{2,}', '*').getRegexp(),
            }));
        }
        setRules() {
            if (this.options.gfm) {
                if (this.options.breaks) {
                    this.rules = this.staticThis.getRulesBreaks();
                }
                else {
                    this.rules = this.staticThis.getRulesGfm();
                }
            }
            else if (this.options.pedantic) {
                this.rules = this.staticThis.getRulesPedantic();
            }
            else {
                this.rules = this.staticThis.getRulesBase();
            }
            this.hasRulesGfm = this.rules.url !== undefined;
        }
        /**
         * Lexing/Compiling.
         */
        output(nextPart) {
            nextPart = nextPart;
            let execArr;
            let out = '';
            while (nextPart) {
                // escape
                if ((execArr = this.rules.escape.exec(nextPart))) {
                    nextPart = nextPart.substring(execArr[0].length);
                    out += execArr[1];
                    continue;
                }
                // autolink
                if ((execArr = this.rules.autolink.exec(nextPart))) {
                    let text;
                    let href;
                    nextPart = nextPart.substring(execArr[0].length);
                    if (execArr[2] === '@') {
                        text = this.options.escape(execArr[1].charAt(6) === ':' ? this.mangle(execArr[1].substring(7)) : this.mangle(execArr[1]));
                        href = this.mangle('mailto:') + text;
                    }
                    else {
                        text = this.options.escape(execArr[1]);
                        href = text;
                    }
                    out += this.renderer.link(href, null, text);
                    continue;
                }
                // url (gfm)
                if (!this.inLink && this.hasRulesGfm && (execArr = this.rules.url.exec(nextPart))) {
                    let text;
                    let href;
                    nextPart = nextPart.substring(execArr[0].length);
                    text = this.options.escape(execArr[1]);
                    href = text;
                    out += this.renderer.link(href, null, text);
                    continue;
                }
                // tag
                if ((execArr = this.rules.tag.exec(nextPart))) {
                    if (!this.inLink && /^<a /i.test(execArr[0])) {
                        this.inLink = true;
                    }
                    else if (this.inLink && /^<\/a>/i.test(execArr[0])) {
                        this.inLink = false;
                    }
                    nextPart = nextPart.substring(execArr[0].length);
                    out += this.options.sanitize
                        ? this.options.sanitizer
                            ? this.options.sanitizer(execArr[0])
                            : this.options.escape(execArr[0])
                        : execArr[0];
                    continue;
                }
                // link
                if ((execArr = this.rules.link.exec(nextPart))) {
                    nextPart = nextPart.substring(execArr[0].length);
                    this.inLink = true;
                    out += this.outputLink(execArr, {
                        href: execArr[2],
                        title: execArr[3],
                    });
                    this.inLink = false;
                    continue;
                }
                // reflink, nolink
                if ((execArr = this.rules.reflink.exec(nextPart)) || (execArr = this.rules.nolink.exec(nextPart))) {
                    nextPart = nextPart.substring(execArr[0].length);
                    const keyLink = (execArr[2] || execArr[1]).replace(/\s+/g, ' ');
                    const link = this.links[keyLink.toLowerCase()];
                    if (!link || !link.href) {
                        out += execArr[0].charAt(0);
                        nextPart = execArr[0].substring(1) + nextPart;
                        continue;
                    }
                    this.inLink = true;
                    out += this.outputLink(execArr, link);
                    this.inLink = false;
                    continue;
                }
                // strong
                if ((execArr = this.rules.strong.exec(nextPart))) {
                    nextPart = nextPart.substring(execArr[0].length);
                    out += this.renderer.strong(this.output(execArr[2] || execArr[1]));
                    continue;
                }
                // em
                if ((execArr = this.rules.em.exec(nextPart))) {
                    nextPart = nextPart.substring(execArr[0].length);
                    out += this.renderer.em(this.output(execArr[2] || execArr[1]));
                    continue;
                }
                // code
                if ((execArr = this.rules.code.exec(nextPart))) {
                    nextPart = nextPart.substring(execArr[0].length);
                    out += this.renderer.codespan(this.options.escape(execArr[2].trim(), true));
                    continue;
                }
                // br
                if ((execArr = this.rules.br.exec(nextPart))) {
                    nextPart = nextPart.substring(execArr[0].length);
                    out += this.renderer.br();
                    continue;
                }
                // del (gfm)
                if (this.hasRulesGfm && (execArr = this.rules.del.exec(nextPart))) {
                    nextPart = nextPart.substring(execArr[0].length);
                    out += this.renderer.del(this.output(execArr[1]));
                    continue;
                }
                // text
                if ((execArr = this.rules.text.exec(nextPart))) {
                    nextPart = nextPart.substring(execArr[0].length);
                    out += this.renderer.text(this.options.escape(this.smartypants(execArr[0])));
                    continue;
                }
                if (nextPart) {
                    throw new Error('Infinite loop on byte: ' + nextPart.charCodeAt(0));
                }
            }
            return out;
        }
        /**
         * Compile Link.
         */
        outputLink(execArr, link) {
            const href = this.options.escape(link.href);
            const title = link.title ? this.options.escape(link.title) : null;
            return execArr[0].charAt(0) !== '!'
                ? this.renderer.link(href, title, this.output(execArr[1]))
                : this.renderer.image(href, title, this.options.escape(execArr[1]));
        }
        /**
         * Smartypants Transformations.
         */
        smartypants(text) {
            if (!this.options.smartypants) {
                return text;
            }
            return (text
                // em-dashes
                .replace(/---/g, '\u2014')
                // en-dashes
                .replace(/--/g, '\u2013')
                // opening singles
                .replace(/(^|[-\u2014/(\[{"\s])'/g, '$1\u2018')
                // closing singles & apostrophes
                .replace(/'/g, '\u2019')
                // opening doubles
                .replace(/(^|[-\u2014/(\[{\u2018\s])"/g, '$1\u201c')
                // closing doubles
                .replace(/"/g, '\u201d')
                // ellipses
                .replace(/\.{3}/g, '\u2026'));
        }
        /**
         * Mangle Links.
         */
        mangle(text) {
            if (!this.options.mangle) {
                return text;
            }
            let out = '';
            const length = text.length;
            for (let i = 0; i < length; i++) {
                let str;
                if (Math.random() > 0.5) {
                    str = 'x' + text.charCodeAt(i).toString(16);
                }
                out += '&#' + str + ';';
            }
            return out;
        }
    }
    InlineLexer.rulesBase = null;
    /**
     * Pedantic Inline Grammar.
     */
    InlineLexer.rulesPedantic = null;
    /**
     * GFM Inline Grammar
     */
    InlineLexer.rulesGfm = null;
    /**
     * GFM + Line Breaks Inline Grammar.
     */
    InlineLexer.rulesBreaks = null;

    /**
     * @license
     *
     * Copyright (c) 2011-2014, Christopher Jeffrey. (MIT Licensed)
     * https://github.com/chjj/marked
     *
     * Copyright (c) 2018-2021, Костя Третяк. (MIT Licensed)
     * https://github.com/ts-stack/markdown
     */
    /**
     * Parsing & Compiling.
     */
    class Parser {
        constructor(options) {
            this.simpleRenderers = [];
            this.line = 0;
            this.tokens = [];
            this.token = null;
            this.options = options || Marked.options;
            this.renderer = this.options.renderer || new Renderer(this.options);
        }
        static parse(tokens, links, options) {
            const parser = new this(options);
            return parser.parse(links, tokens);
        }
        parse(links, tokens) {
            this.inlineLexer = new InlineLexer(InlineLexer, links, this.options, this.renderer);
            this.tokens = tokens.reverse();
            let out = '';
            while (this.next()) {
                out += this.tok();
            }
            return out;
        }
        debug(links, tokens) {
            this.inlineLexer = new InlineLexer(InlineLexer, links, this.options, this.renderer);
            this.tokens = tokens.reverse();
            let out = '';
            while (this.next()) {
                const outToken = this.tok();
                this.token.line = this.line += outToken.split('\n').length - 1;
                out += outToken;
            }
            return out;
        }
        next() {
            return (this.token = this.tokens.pop());
        }
        getNextElement() {
            return this.tokens[this.tokens.length - 1];
        }
        parseText() {
            let body = this.token.text;
            let nextElement;
            while ((nextElement = this.getNextElement()) && nextElement.type == TokenType.text) {
                body += '\n' + this.next().text;
            }
            return this.inlineLexer.output(body);
        }
        tok() {
            switch (this.token.type) {
                case TokenType.space: {
                    return '';
                }
                case TokenType.paragraph: {
                    return this.renderer.paragraph(this.inlineLexer.output(this.token.text));
                }
                case TokenType.text: {
                    if (this.options.isNoP) {
                        return this.parseText();
                    }
                    else {
                        return this.renderer.paragraph(this.parseText());
                    }
                }
                case TokenType.heading: {
                    return this.renderer.heading(this.inlineLexer.output(this.token.text), this.token.depth, this.token.text);
                }
                case TokenType.listStart: {
                    let body = '';
                    const ordered = this.token.ordered;
                    while (this.next().type != TokenType.listEnd) {
                        body += this.tok();
                    }
                    return this.renderer.list(body, ordered);
                }
                case TokenType.listItemStart: {
                    let body = '';
                    while (this.next().type != TokenType.listItemEnd) {
                        body += this.token.type == TokenType.text ? this.parseText() : this.tok();
                    }
                    return this.renderer.listitem(body);
                }
                case TokenType.looseItemStart: {
                    let body = '';
                    while (this.next().type != TokenType.listItemEnd) {
                        body += this.tok();
                    }
                    return this.renderer.listitem(body);
                }
                case TokenType.code: {
                    return this.renderer.code(this.token.text, this.token.lang, this.token.escaped, this.token.meta);
                }
                case TokenType.table: {
                    let header = '';
                    let body = '';
                    let cell;
                    // header
                    cell = '';
                    for (let i = 0; i < this.token.header.length; i++) {
                        const flags = { header: true, align: this.token.align[i] };
                        const out = this.inlineLexer.output(this.token.header[i]);
                        cell += this.renderer.tablecell(out, flags);
                    }
                    header += this.renderer.tablerow(cell);
                    for (const row of this.token.cells) {
                        cell = '';
                        for (let j = 0; j < row.length; j++) {
                            cell += this.renderer.tablecell(this.inlineLexer.output(row[j]), {
                                header: false,
                                align: this.token.align[j]
                            });
                        }
                        body += this.renderer.tablerow(cell);
                    }
                    return this.renderer.table(header, body);
                }
                case TokenType.blockquoteStart: {
                    let body = '';
                    while (this.next().type != TokenType.blockquoteEnd) {
                        body += this.tok();
                    }
                    return this.renderer.blockquote(body);
                }
                case TokenType.hr: {
                    return this.renderer.hr();
                }
                case TokenType.html: {
                    const html = !this.token.pre && !this.options.pedantic ? this.inlineLexer.output(this.token.text) : this.token.text;
                    return this.renderer.html(html);
                }
                default: {
                    if (this.simpleRenderers.length) {
                        for (let i = 0; i < this.simpleRenderers.length; i++) {
                            if (this.token.type == 'simpleRule' + (i + 1)) {
                                return this.simpleRenderers[i].call(this.renderer, this.token.execArr);
                            }
                        }
                    }
                    const errMsg = `Token with "${this.token.type}" type was not found.`;
                    if (this.options.silent) {
                        console.log(errMsg);
                    }
                    else {
                        throw new Error(errMsg);
                    }
                }
            }
        }
    }

    /**
     * @license
     *
     * Copyright (c) 2011-2014, Christopher Jeffrey. (MIT Licensed)
     * https://github.com/chjj/marked
     *
     * Copyright (c) 2018-2021, Костя Третяк. (MIT Licensed)
     * https://github.com/ts-stack/markdown
     */
    class Marked {
        /**
         * Merges the default options with options that will be set.
         *
         * @param options Hash of options.
         */
        static setOptions(options) {
            Object.assign(this.options, options);
            return this;
        }
        /**
         * Setting simple block rule.
         */
        static setBlockRule(regexp, renderer = () => '') {
            BlockLexer.simpleRules.push(regexp);
            this.simpleRenderers.push(renderer);
            return this;
        }
        /**
         * Accepts Markdown text and returns text in HTML format.
         *
         * @param src String of markdown source to be compiled.
         * @param options Hash of options. They replace, but do not merge with the default options.
         * If you want the merging, you can to do this via `Marked.setOptions()`.
         */
        static parse(src, options = this.options) {
            try {
                const { tokens, links } = this.callBlockLexer(src, options);
                return this.callParser(tokens, links, options);
            }
            catch (e) {
                return this.callMe(e);
            }
        }
        /**
         * Accepts Markdown text and returns object with text in HTML format,
         * tokens and links from `BlockLexer.parser()`.
         *
         * @param src String of markdown source to be compiled.
         * @param options Hash of options. They replace, but do not merge with the default options.
         * If you want the merging, you can to do this via `Marked.setOptions()`.
         */
        static debug(src, options = this.options) {
            const { tokens, links } = this.callBlockLexer(src, options);
            let origin = tokens.slice();
            const parser = new Parser(options);
            parser.simpleRenderers = this.simpleRenderers;
            const result = parser.debug(links, tokens);
            /**
             * Translates a token type into a readable form,
             * and moves `line` field to a first place in a token object.
             */
            origin = origin.map(token => {
                token.type = TokenType[token.type] || token.type;
                const line = token.line;
                delete token.line;
                if (line) {
                    return Object.assign({ line }, token);
                }
                else {
                    return token;
                }
            });
            return { tokens: origin, links, result };
        }
        static callBlockLexer(src = '', options) {
            if (typeof src != 'string') {
                throw new Error(`Expected that the 'src' parameter would have a 'string' type, got '${typeof src}'`);
            }
            // Preprocessing.
            src = src
                .replace(/\r\n|\r/g, '\n')
                .replace(/\t/g, '    ')
                .replace(/\u00a0/g, ' ')
                .replace(/\u2424/g, '\n')
                .replace(/^ +$/gm, '');
            return BlockLexer.lex(src, options, true);
        }
        static callParser(tokens, links, options) {
            if (this.simpleRenderers.length) {
                const parser = new Parser(options);
                parser.simpleRenderers = this.simpleRenderers;
                return parser.parse(links, tokens);
            }
            else {
                return Parser.parse(tokens, links, options);
            }
        }
        static callMe(err) {
            err.message += '\nPlease report this to https://github.com/ts-stack/markdown';
            if (this.options.silent) {
                return '<p>An error occured:</p><pre>' + this.options.escape(err.message + '', true) + '</pre>';
            }
            throw err;
        }
    }
    Marked.options = new MarkedOptions();
    Marked.simpleRenderers = [];

    /**
     * @license
     *
     * Copyright (c) 2011-2014, Christopher Jeffrey. (MIT Licensed)
     * https://github.com/chjj/marked
     *
     * Copyright (c) 2018-2021, Костя Третяк. (MIT Licensed)
     * https://github.com/ts-stack/markdown
     */
    class BlockLexer {
        constructor(staticThis, options) {
            this.staticThis = staticThis;
            this.links = {};
            this.tokens = [];
            this.options = options || Marked.options;
            this.setRules();
        }
        /**
         * Accepts Markdown text and returns object with tokens and links.
         *
         * @param src String of markdown source to be compiled.
         * @param options Hash of options.
         */
        static lex(src, options, top, isBlockQuote) {
            const lexer = new this(this, options);
            return lexer.getTokens(src, top, isBlockQuote);
        }
        static getRulesBase() {
            if (this.rulesBase) {
                return this.rulesBase;
            }
            const base = {
                newline: /^\n+/,
                code: /^( {4}[^\n]+\n*)+/,
                hr: /^( *[-*_]){3,} *(?:\n+|$)/,
                heading: /^ *(#{1,6}) *([^\n]+?) *#* *(?:\n+|$)/,
                lheading: /^([^\n]+)\n *(=|-){2,} *(?:\n+|$)/,
                blockquote: /^( *>[^\n]+(\n[^\n]+)*\n*)+/,
                list: /^( *)(bull) [\s\S]+?(?:hr|def|\n{2,}(?! )(?!\1bull )\n*|\s*$)/,
                html: /^ *(?:comment *(?:\n|\s*$)|closed *(?:\n{2,}|\s*$)|closing *(?:\n{2,}|\s*$))/,
                def: /^ *\[([^\]]+)\]: *<?([^\s>]+)>?(?: +["(]([^\n]+)[")])? *(?:\n+|$)/,
                paragraph: /^((?:[^\n]+\n?(?!hr|heading|lheading|blockquote|tag|def))+)\n*/,
                text: /^[^\n]+/,
                bullet: /(?:[*+-]|\d+\.)/,
                item: /^( *)(bull) [^\n]*(?:\n(?!\1bull )[^\n]*)*/,
            };
            base.item = new ExtendRegexp(base.item, 'gm').setGroup(/bull/g, base.bullet).getRegexp();
            base.list = new ExtendRegexp(base.list)
                .setGroup(/bull/g, base.bullet)
                .setGroup('hr', '\\n+(?=\\1?(?:[-*_] *){3,}(?:\\n+|$))')
                .setGroup('def', '\\n+(?=' + base.def.source + ')')
                .getRegexp();
            const tag = '(?!(?:' +
                'a|em|strong|small|s|cite|q|dfn|abbr|data|time|code' +
                '|var|samp|kbd|sub|sup|i|b|u|mark|ruby|rt|rp|bdi|bdo' +
                '|span|br|wbr|ins|del|img)\\b)\\w+(?!:/|[^\\w\\s@]*@)\\b';
            base.html = new ExtendRegexp(base.html)
                .setGroup('comment', /<!--[\s\S]*?-->/)
                .setGroup('closed', /<(tag)[\s\S]+?<\/\1>/)
                .setGroup('closing', /<tag(?:"[^"]*"|'[^']*'|[^'">])*?>/)
                .setGroup(/tag/g, tag)
                .getRegexp();
            base.paragraph = new ExtendRegexp(base.paragraph)
                .setGroup('hr', base.hr)
                .setGroup('heading', base.heading)
                .setGroup('lheading', base.lheading)
                .setGroup('blockquote', base.blockquote)
                .setGroup('tag', '<' + tag)
                .setGroup('def', base.def)
                .getRegexp();
            return (this.rulesBase = base);
        }
        static getRulesGfm() {
            if (this.rulesGfm) {
                return this.rulesGfm;
            }
            const base = this.getRulesBase();
            const gfm = Object.assign(Object.assign({}, base), {
                fences: /^ *(`{3,}|~{3,})[ \.]*((\S+)? *[^\n]*)\n([\s\S]*?)\s*\1 *(?:\n+|$)/,
                paragraph: /^/,
                heading: /^ *(#{1,6}) +([^\n]+?) *#* *(?:\n+|$)/,
            });
            const group1 = gfm.fences.source.replace('\\1', '\\2');
            const group2 = base.list.source.replace('\\1', '\\3');
            gfm.paragraph = new ExtendRegexp(base.paragraph).setGroup('(?!', `(?!${group1}|${group2}|`).getRegexp();
            return (this.rulesGfm = gfm);
        }
        static getRulesTable() {
            if (this.rulesTables) {
                return this.rulesTables;
            }
            return (this.rulesTables = Object.assign(Object.assign({}, this.getRulesGfm()), {
                nptable: /^ *(\S.*\|.*)\n *([-:]+ *\|[-| :]*)\n((?:.*\|.*(?:\n|$))*)\n*/,
                table: /^ *\|(.+)\n *\|( *[-:]+[-| :]*)\n((?: *\|.*(?:\n|$))*)\n*/,
            }));
        }
        setRules() {
            if (this.options.gfm) {
                if (this.options.tables) {
                    this.rules = this.staticThis.getRulesTable();
                }
                else {
                    this.rules = this.staticThis.getRulesGfm();
                }
            }
            else {
                this.rules = this.staticThis.getRulesBase();
            }
            this.hasRulesGfm = this.rules.fences !== undefined;
            this.hasRulesTables = this.rules.table !== undefined;
        }
        /**
         * Lexing.
         */
        getTokens(src, top, isBlockQuote) {
            let nextPart = src;
            let execArr;
            mainLoop: while (nextPart) {
                // newline
                if ((execArr = this.rules.newline.exec(nextPart))) {
                    nextPart = nextPart.substring(execArr[0].length);
                    if (execArr[0].length > 1) {
                        this.tokens.push({ type: TokenType.space });
                    }
                }
                // code
                if ((execArr = this.rules.code.exec(nextPart))) {
                    nextPart = nextPart.substring(execArr[0].length);
                    const code = execArr[0].replace(/^ {4}/gm, '');
                    this.tokens.push({
                        type: TokenType.code,
                        text: !this.options.pedantic ? code.replace(/\n+$/, '') : code,
                    });
                    continue;
                }
                // fences code (gfm)
                if (this.hasRulesGfm && (execArr = this.rules.fences.exec(nextPart))) {
                    nextPart = nextPart.substring(execArr[0].length);
                    this.tokens.push({
                        type: TokenType.code,
                        meta: execArr[2],
                        lang: execArr[3],
                        text: execArr[4] || '',
                    });
                    continue;
                }
                // heading
                if ((execArr = this.rules.heading.exec(nextPart))) {
                    nextPart = nextPart.substring(execArr[0].length);
                    this.tokens.push({
                        type: TokenType.heading,
                        depth: execArr[1].length,
                        text: execArr[2],
                    });
                    continue;
                }
                // table no leading pipe (gfm)
                if (top && this.hasRulesTables && (execArr = this.rules.nptable.exec(nextPart))) {
                    nextPart = nextPart.substring(execArr[0].length);
                    const item = {
                        type: TokenType.table,
                        header: execArr[1].replace(/^ *| *\| *$/g, '').split(/ *\| */),
                        align: execArr[2].replace(/^ *|\| *$/g, '').split(/ *\| */),
                        cells: [],
                    };
                    for (let i = 0; i < item.align.length; i++) {
                        if (/^ *-+: *$/.test(item.align[i])) {
                            item.align[i] = 'right';
                        }
                        else if (/^ *:-+: *$/.test(item.align[i])) {
                            item.align[i] = 'center';
                        }
                        else if (/^ *:-+ *$/.test(item.align[i])) {
                            item.align[i] = 'left';
                        }
                        else {
                            item.align[i] = null;
                        }
                    }
                    const td = execArr[3].replace(/\n$/, '').split('\n');
                    for (let i = 0; i < td.length; i++) {
                        item.cells[i] = td[i].split(/ *\| */);
                    }
                    this.tokens.push(item);
                    continue;
                }
                // lheading
                if ((execArr = this.rules.lheading.exec(nextPart))) {
                    nextPart = nextPart.substring(execArr[0].length);
                    this.tokens.push({
                        type: TokenType.heading,
                        depth: execArr[2] === '=' ? 1 : 2,
                        text: execArr[1],
                    });
                    continue;
                }
                // hr
                if ((execArr = this.rules.hr.exec(nextPart))) {
                    nextPart = nextPart.substring(execArr[0].length);
                    this.tokens.push({ type: TokenType.hr });
                    continue;
                }
                // blockquote
                if ((execArr = this.rules.blockquote.exec(nextPart))) {
                    nextPart = nextPart.substring(execArr[0].length);
                    this.tokens.push({ type: TokenType.blockquoteStart });
                    const str = execArr[0].replace(/^ *> ?/gm, '');
                    // Pass `top` to keep the current
                    // "toplevel" state. This is exactly
                    // how markdown.pl works.
                    this.getTokens(str);
                    this.tokens.push({ type: TokenType.blockquoteEnd });
                    continue;
                }
                // list
                if ((execArr = this.rules.list.exec(nextPart))) {
                    nextPart = nextPart.substring(execArr[0].length);
                    const bull = execArr[2];
                    this.tokens.push({ type: TokenType.listStart, ordered: bull.length > 1 });
                    // Get each top-level item.
                    const str = execArr[0].match(this.rules.item);
                    const length = str.length;
                    let next = false;
                    let space;
                    let blockBullet;
                    let loose;
                    for (let i = 0; i < length; i++) {
                        let item = str[i];
                        // Remove the list item's bullet so it is seen as the next token.
                        space = item.length;
                        item = item.replace(/^ *([*+-]|\d+\.) +/, '');
                        // Outdent whatever the list item contains. Hacky.
                        if (item.indexOf('\n ') !== -1) {
                            space -= item.length;
                            item = !this.options.pedantic
                                ? item.replace(new RegExp('^ {1,' + space + '}', 'gm'), '')
                                : item.replace(/^ {1,4}/gm, '');
                        }
                        // Determine whether the next list item belongs here.
                        // Backpedal if it does not belong in this list.
                        if (this.options.smartLists && i !== length - 1) {
                            blockBullet = this.staticThis.getRulesBase().bullet.exec(str[i + 1])[0];
                            if (bull !== blockBullet && !(bull.length > 1 && blockBullet.length > 1)) {
                                nextPart = str.slice(i + 1).join('\n') + nextPart;
                                i = length - 1;
                            }
                        }
                        // Determine whether item is loose or not.
                        // Use: /(^|\n)(?! )[^\n]+\n\n(?!\s*$)/
                        // for discount behavior.
                        loose = next || /\n\n(?!\s*$)/.test(item);
                        if (i !== length - 1) {
                            next = item.charAt(item.length - 1) === '\n';
                            if (!loose) {
                                loose = next;
                            }
                        }
                        this.tokens.push({ type: loose ? TokenType.looseItemStart : TokenType.listItemStart });
                        // Recurse.
                        this.getTokens(item, false, isBlockQuote);
                        this.tokens.push({ type: TokenType.listItemEnd });
                    }
                    this.tokens.push({ type: TokenType.listEnd });
                    continue;
                }
                // html
                if ((execArr = this.rules.html.exec(nextPart))) {
                    nextPart = nextPart.substring(execArr[0].length);
                    const attr = execArr[1];
                    const isPre = attr === 'pre' || attr === 'script' || attr === 'style';
                    this.tokens.push({
                        type: this.options.sanitize ? TokenType.paragraph : TokenType.html,
                        pre: !this.options.sanitizer && isPre,
                        text: execArr[0],
                    });
                    continue;
                }
                // def
                if (top && (execArr = this.rules.def.exec(nextPart))) {
                    nextPart = nextPart.substring(execArr[0].length);
                    this.links[execArr[1].toLowerCase()] = {
                        href: execArr[2],
                        title: execArr[3],
                    };
                    continue;
                }
                // table (gfm)
                if (top && this.hasRulesTables && (execArr = this.rules.table.exec(nextPart))) {
                    nextPart = nextPart.substring(execArr[0].length);
                    const item = {
                        type: TokenType.table,
                        header: execArr[1].replace(/^ *| *\| *$/g, '').split(/ *\| */),
                        align: execArr[2].replace(/^ *|\| *$/g, '').split(/ *\| */),
                        cells: [],
                    };
                    for (let i = 0; i < item.align.length; i++) {
                        if (/^ *-+: *$/.test(item.align[i])) {
                            item.align[i] = 'right';
                        }
                        else if (/^ *:-+: *$/.test(item.align[i])) {
                            item.align[i] = 'center';
                        }
                        else if (/^ *:-+ *$/.test(item.align[i])) {
                            item.align[i] = 'left';
                        }
                        else {
                            item.align[i] = null;
                        }
                    }
                    const td = execArr[3].replace(/(?: *\| *)?\n$/, '').split('\n');
                    for (let i = 0; i < td.length; i++) {
                        item.cells[i] = td[i].replace(/^ *\| *| *\| *$/g, '').split(/ *\| */);
                    }
                    this.tokens.push(item);
                    continue;
                }
                // simple rules
                if (this.staticThis.simpleRules.length) {
                    const simpleRules = this.staticThis.simpleRules;
                    for (let i = 0; i < simpleRules.length; i++) {
                        if ((execArr = simpleRules[i].exec(nextPart))) {
                            nextPart = nextPart.substring(execArr[0].length);
                            const type = 'simpleRule' + (i + 1);
                            this.tokens.push({ type, execArr });
                            continue mainLoop;
                        }
                    }
                }
                // top-level paragraph
                if (top && (execArr = this.rules.paragraph.exec(nextPart))) {
                    nextPart = nextPart.substring(execArr[0].length);
                    if (execArr[1].slice(-1) === '\n') {
                        this.tokens.push({
                            type: TokenType.paragraph,
                            text: execArr[1].slice(0, -1),
                        });
                    }
                    else {
                        this.tokens.push({
                            type: this.tokens.length > 0 ? TokenType.paragraph : TokenType.text,
                            text: execArr[1],
                        });
                    }
                    continue;
                }
                // text
                // Top-level should never reach here.
                if ((execArr = this.rules.text.exec(nextPart))) {
                    nextPart = nextPart.substring(execArr[0].length);
                    this.tokens.push({ type: TokenType.text, text: execArr[0] });
                    continue;
                }
                if (nextPart) {
                    throw new Error('Infinite loop on byte: ' + nextPart.charCodeAt(0) + `, near text '${nextPart.slice(0, 30)}...'`);
                }
            }
            return { tokens: this.tokens, links: this.links };
        }
    }
    BlockLexer.simpleRules = [];
    BlockLexer.rulesBase = null;
    /**
     * GFM Block Grammar.
     */
    BlockLexer.rulesGfm = null;
    /**
     * GFM + Tables Block Grammar.
     */
    BlockLexer.rulesTables = null;

    const fetchIndex = async (collection) => {
        const response = await fetch(`collections/${collection}/index.json`);
        const data = await response.json();
        return data;
    };
    const zen = readable([], function (set) {
        fetchIndex('zen').then((data) => {
            const today = new Date();
            set(data.filter((item) => {
                const published = new Date(item.published);
                return published.getTime() <= today.getTime();
            }));
        });
        return () => { };
    });
    const dadJokes = readable([], function (set) {
        fetchIndex('dad-jokes').then((data) => {
            const today = new Date();
            set(data.filter((item) => {
                const published = new Date(item.published);
                return published.getTime() <= today.getTime();
            }));
        });
        return () => { };
    });
    const blog = readable([], function (set) {
        fetchIndex('blog').then((data) => {
            const today = new Date();
            set(data.filter((item) => {
                const published = new Date(item.published);
                return published.getTime() <= today.getTime();
            }));
        });
        return () => { };
    });
    const recipes = readable([], function (set) {
        fetchIndex('recipes').then((data) => {
            const today = new Date();
            set(data.filter((item) => {
                const published = new Date(item.published);
                return published.getTime() <= today.getTime();
            }));
        });
        return () => { };
    });

    /* src/routes/Zen.svelte generated by Svelte v3.44.1 */
    const file$6 = "src/routes/Zen.svelte";

    function get_each_context$4(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[4] = list[i];
    	return child_ctx;
    }

    // (80:2) {#if doc}
    function create_if_block_1$3(ctx) {
    	let div3;
    	let div1;
    	let figure;
    	let img;
    	let img_alt_value;
    	let img_src_value;
    	let t0;
    	let div0;
    	let p;
    	let t1_value = /*doc*/ ctx[4].text + "";
    	let t1;
    	let t2;
    	let div2;
    	let div3_intro;

    	const block = {
    		c: function create() {
    			div3 = element("div");
    			div1 = element("div");
    			figure = element("figure");
    			img = element("img");
    			t0 = space();
    			div0 = element("div");
    			p = element("p");
    			t1 = text(t1_value);
    			t2 = space();
    			div2 = element("div");
    			this.h();
    		},
    		l: function claim(nodes) {
    			div3 = claim_element(nodes, "DIV", { class: true });
    			var div3_nodes = children(div3);
    			div1 = claim_element(div3_nodes, "DIV", { class: true });
    			var div1_nodes = children(div1);
    			figure = claim_element(div1_nodes, "FIGURE", {});
    			var figure_nodes = children(figure);
    			img = claim_element(figure_nodes, "IMG", { class: true, alt: true, src: true });
    			figure_nodes.forEach(detach_dev);
    			t0 = claim_space(div1_nodes);
    			div0 = claim_element(div1_nodes, "DIV", { class: true });
    			var div0_nodes = children(div0);
    			p = claim_element(div0_nodes, "P", { class: true });
    			var p_nodes = children(p);
    			t1 = claim_text(p_nodes, t1_value);
    			p_nodes.forEach(detach_dev);
    			div0_nodes.forEach(detach_dev);
    			div1_nodes.forEach(detach_dev);
    			t2 = claim_space(div3_nodes);
    			div2 = claim_element(div3_nodes, "DIV", { class: true });
    			var div2_nodes = children(div2);
    			div2_nodes.forEach(detach_dev);
    			div3_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(img, "class", "h-full");
    			attr_dev(img, "alt", img_alt_value = /*doc*/ ctx[4].title);
    			if (!src_url_equal(img.src, img_src_value = "collections/zen/" + /*doc*/ ctx[4].id + "/image.webp")) attr_dev(img, "src", img_src_value);
    			add_location(img, file$6, 83, 10, 2467);
    			add_location(figure, file$6, 82, 8, 2448);
    			attr_dev(p, "class", "italic");
    			add_location(p, file$6, 86, 10, 2609);
    			attr_dev(div0, "class", "card-body");
    			add_location(div0, file$6, 85, 8, 2575);
    			attr_dev(div1, "class", "flex-1 card lg:card-side lg:h-64 md:w-2/3 xl:w-3/4");
    			add_location(div1, file$6, 81, 6, 2375);
    			attr_dev(div2, "class", "flex-1 lg:h-64 md:w-2/3 xl:w-3/4 p-6 space-y-6");
    			add_location(div2, file$6, 90, 6, 2678);
    			attr_dev(div3, "class", "container mx-auto w-full flex flex-col items-center pt-4 pb-12");
    			add_location(div3, file$6, 80, 4, 2284);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, div3, anchor);
    			append_hydration_dev(div3, div1);
    			append_hydration_dev(div1, figure);
    			append_hydration_dev(figure, img);
    			append_hydration_dev(div1, t0);
    			append_hydration_dev(div1, div0);
    			append_hydration_dev(div0, p);
    			append_hydration_dev(p, t1);
    			append_hydration_dev(div3, t2);
    			append_hydration_dev(div3, div2);
    			div2.innerHTML = /*docMD*/ ctx[2];
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*doc*/ 16 && img_alt_value !== (img_alt_value = /*doc*/ ctx[4].title)) {
    				attr_dev(img, "alt", img_alt_value);
    			}

    			if (dirty & /*doc*/ 16 && !src_url_equal(img.src, img_src_value = "collections/zen/" + /*doc*/ ctx[4].id + "/image.webp")) {
    				attr_dev(img, "src", img_src_value);
    			}

    			if (dirty & /*doc*/ 16 && t1_value !== (t1_value = /*doc*/ ctx[4].text + "")) set_data_dev(t1, t1_value);
    			if (dirty & /*docMD*/ 4) div2.innerHTML = /*docMD*/ ctx[2];		},
    		i: function intro(local) {
    			if (!div3_intro) {
    				add_render_callback(() => {
    					div3_intro = create_in_transition(div3, fade, {});
    					div3_intro.start();
    				});
    			}
    		},
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div3);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1$3.name,
    		type: "if",
    		source: "(80:2) {#if doc}",
    		ctx
    	});

    	return block;
    }

    // (50:0) {#if !id}
    function create_if_block$3(ctx) {
    	let div2;
    	let div1;
    	let div0;
    	let t0;
    	let h2;
    	let t1;
    	let h2_intro;
    	let t2;
    	let div2_intro;
    	let each_value = /*$zen*/ ctx[3];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block$4(get_each_context$4(ctx, each_value, i));
    	}

    	const block = {
    		c: function create() {
    			div2 = element("div");
    			div1 = element("div");
    			div0 = element("div");
    			t0 = space();
    			h2 = element("h2");
    			t1 = text("Postive Motivation for a Troubled World");
    			t2 = space();

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			this.h();
    		},
    		l: function claim(nodes) {
    			div2 = claim_element(nodes, "DIV", { class: true });
    			var div2_nodes = children(div2);
    			div1 = claim_element(div2_nodes, "DIV", { class: true });
    			var div1_nodes = children(div1);
    			div0 = claim_element(div1_nodes, "DIV", { class: true });
    			children(div0).forEach(detach_dev);
    			div1_nodes.forEach(detach_dev);
    			t0 = claim_space(div2_nodes);
    			h2 = claim_element(div2_nodes, "H2", { class: true });
    			var h2_nodes = children(h2);
    			t1 = claim_text(h2_nodes, "Postive Motivation for a Troubled World");
    			h2_nodes.forEach(detach_dev);
    			t2 = claim_space(div2_nodes);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].l(div2_nodes);
    			}

    			div2_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(div0, "class", "h-1 mx-auto gradient w-64 opacity-25 my-0 py-0 rounded-t");
    			add_location(div0, file$6, 52, 6, 1411);
    			attr_dev(div1, "class", "w-full mb-4");
    			add_location(div1, file$6, 51, 4, 1379);
    			attr_dev(h2, "class", "w-full my-2 text-xl lg:text-2xl font-bold leading-tight text-center");
    			add_location(h2, file$6, 54, 4, 1499);
    			attr_dev(div2, "class", "container mx-auto flex flex-wrap pt-4 pb-12");
    			add_location(div2, file$6, 50, 2, 1309);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, div2, anchor);
    			append_hydration_dev(div2, div1);
    			append_hydration_dev(div1, div0);
    			append_hydration_dev(div2, t0);
    			append_hydration_dev(div2, h2);
    			append_hydration_dev(h2, t1);
    			append_hydration_dev(div2, t2);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div2, null);
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*$zen*/ 8) {
    				each_value = /*$zen*/ ctx[3];
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context$4(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    						transition_in(each_blocks[i], 1);
    					} else {
    						each_blocks[i] = create_each_block$4(child_ctx);
    						each_blocks[i].c();
    						transition_in(each_blocks[i], 1);
    						each_blocks[i].m(div2, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}
    		},
    		i: function intro(local) {
    			if (!h2_intro) {
    				add_render_callback(() => {
    					h2_intro = create_in_transition(h2, fade, {});
    					h2_intro.start();
    				});
    			}

    			for (let i = 0; i < each_value.length; i += 1) {
    				transition_in(each_blocks[i]);
    			}

    			if (!div2_intro) {
    				add_render_callback(() => {
    					div2_intro = create_in_transition(div2, fade, {});
    					div2_intro.start();
    				});
    			}
    		},
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div2);
    			destroy_each(each_blocks, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$3.name,
    		type: "if",
    		source: "(50:0) {#if !id}",
    		ctx
    	});

    	return block;
    }

    // (62:4) {#each $zen as doc}
    function create_each_block$4(ctx) {
    	let div3;
    	let div2;
    	let div1;
    	let h2;
    	let t0_value = /*doc*/ ctx[4].title + "";
    	let t0;
    	let t1;
    	let p;
    	let t2_value = /*doc*/ ctx[4].text + "";
    	let t2;
    	let t3;
    	let div0;
    	let a;
    	let t4;
    	let a_href_value;
    	let t5;
    	let figure;
    	let img;
    	let img_alt_value;
    	let img_src_value;
    	let t6;
    	let div3_intro;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			div3 = element("div");
    			div2 = element("div");
    			div1 = element("div");
    			h2 = element("h2");
    			t0 = text(t0_value);
    			t1 = space();
    			p = element("p");
    			t2 = text(t2_value);
    			t3 = space();
    			div0 = element("div");
    			a = element("a");
    			t4 = text("Read More");
    			t5 = space();
    			figure = element("figure");
    			img = element("img");
    			t6 = space();
    			this.h();
    		},
    		l: function claim(nodes) {
    			div3 = claim_element(nodes, "DIV", { class: true });
    			var div3_nodes = children(div3);
    			div2 = claim_element(div3_nodes, "DIV", { class: true });
    			var div2_nodes = children(div2);
    			div1 = claim_element(div2_nodes, "DIV", { class: true });
    			var div1_nodes = children(div1);
    			h2 = claim_element(div1_nodes, "H2", { class: true });
    			var h2_nodes = children(h2);
    			t0 = claim_text(h2_nodes, t0_value);
    			h2_nodes.forEach(detach_dev);
    			t1 = claim_space(div1_nodes);
    			p = claim_element(div1_nodes, "P", {});
    			var p_nodes = children(p);
    			t2 = claim_text(p_nodes, t2_value);
    			p_nodes.forEach(detach_dev);
    			t3 = claim_space(div1_nodes);
    			div0 = claim_element(div1_nodes, "DIV", { class: true });
    			var div0_nodes = children(div0);
    			a = claim_element(div0_nodes, "A", { class: true, href: true });
    			var a_nodes = children(a);
    			t4 = claim_text(a_nodes, "Read More");
    			a_nodes.forEach(detach_dev);
    			div0_nodes.forEach(detach_dev);
    			div1_nodes.forEach(detach_dev);
    			t5 = claim_space(div2_nodes);
    			figure = claim_element(div2_nodes, "FIGURE", { class: true });
    			var figure_nodes = children(figure);
    			img = claim_element(figure_nodes, "IMG", { alt: true, src: true });
    			figure_nodes.forEach(detach_dev);
    			div2_nodes.forEach(detach_dev);
    			t6 = claim_space(div3_nodes);
    			div3_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(h2, "class", "card-title");
    			add_location(h2, file$6, 65, 12, 1853);
    			add_location(p, file$6, 66, 12, 1905);
    			attr_dev(a, "class", "btn btn-primary");
    			attr_dev(a, "href", a_href_value = "zen/" + /*doc*/ ctx[4].id);
    			add_location(a, file$6, 68, 14, 1976);
    			attr_dev(div0, "class", "card-actions");
    			add_location(div0, file$6, 67, 12, 1935);
    			attr_dev(div1, "class", "card-body");
    			add_location(div1, file$6, 64, 10, 1817);
    			attr_dev(img, "alt", img_alt_value = /*doc*/ ctx[4].title);
    			if (!src_url_equal(img.src, img_src_value = "collections/zen/" + /*doc*/ ctx[4].id + "/image.webp")) attr_dev(img, "src", img_src_value);
    			add_location(img, file$6, 72, 12, 2125);
    			attr_dev(figure, "class", "m-0");
    			add_location(figure, file$6, 71, 10, 2092);
    			attr_dev(div2, "class", "card bordered shadow-lg image-full");
    			add_location(div2, file$6, 63, 8, 1758);
    			attr_dev(div3, "class", "flex md:w-1/2 lg:w-1/3 xl:w-1/4 p-2");
    			add_location(div3, file$6, 62, 6, 1692);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, div3, anchor);
    			append_hydration_dev(div3, div2);
    			append_hydration_dev(div2, div1);
    			append_hydration_dev(div1, h2);
    			append_hydration_dev(h2, t0);
    			append_hydration_dev(div1, t1);
    			append_hydration_dev(div1, p);
    			append_hydration_dev(p, t2);
    			append_hydration_dev(div1, t3);
    			append_hydration_dev(div1, div0);
    			append_hydration_dev(div0, a);
    			append_hydration_dev(a, t4);
    			append_hydration_dev(div2, t5);
    			append_hydration_dev(div2, figure);
    			append_hydration_dev(figure, img);
    			append_hydration_dev(div3, t6);

    			if (!mounted) {
    				dispose = action_destroyer(link.call(null, a));
    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*$zen*/ 8 && t0_value !== (t0_value = /*doc*/ ctx[4].title + "")) set_data_dev(t0, t0_value);
    			if (dirty & /*$zen*/ 8 && t2_value !== (t2_value = /*doc*/ ctx[4].text + "")) set_data_dev(t2, t2_value);

    			if (dirty & /*$zen*/ 8 && a_href_value !== (a_href_value = "zen/" + /*doc*/ ctx[4].id)) {
    				attr_dev(a, "href", a_href_value);
    			}

    			if (dirty & /*$zen*/ 8 && img_alt_value !== (img_alt_value = /*doc*/ ctx[4].title)) {
    				attr_dev(img, "alt", img_alt_value);
    			}

    			if (dirty & /*$zen*/ 8 && !src_url_equal(img.src, img_src_value = "collections/zen/" + /*doc*/ ctx[4].id + "/image.webp")) {
    				attr_dev(img, "src", img_src_value);
    			}
    		},
    		i: function intro(local) {
    			if (!div3_intro) {
    				add_render_callback(() => {
    					div3_intro = create_in_transition(div3, fade, {});
    					div3_intro.start();
    				});
    			}
    		},
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div3);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block$4.name,
    		type: "each",
    		source: "(62:4) {#each $zen as doc}",
    		ctx
    	});

    	return block;
    }

    // (48:0) <Content bind:this={content}>
    function create_default_slot$5(ctx) {
    	let if_block_anchor;

    	function select_block_type(ctx, dirty) {
    		if (!/*id*/ ctx[0]) return create_if_block$3;
    		if (/*doc*/ ctx[4]) return create_if_block_1$3;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block = current_block_type && current_block_type(ctx);

    	const block = {
    		c: function create() {
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    		},
    		l: function claim(nodes) {
    			if (if_block) if_block.l(nodes);
    			if_block_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			if (if_block) if_block.m(target, anchor);
    			insert_hydration_dev(target, if_block_anchor, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block) {
    				if_block.p(ctx, dirty);
    			} else {
    				if (if_block) if_block.d(1);
    				if_block = current_block_type && current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					transition_in(if_block, 1);
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			}
    		},
    		i: function intro(local) {
    			transition_in(if_block);
    		},
    		o: noop,
    		d: function destroy(detaching) {
    			if (if_block) {
    				if_block.d(detaching);
    			}

    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot$5.name,
    		type: "slot",
    		source: "(48:0) <Content bind:this={content}>",
    		ctx
    	});

    	return block;
    }

    function create_fragment$6(ctx) {
    	let content_1;
    	let current;

    	let content_1_props = {
    		$$slots: { default: [create_default_slot$5] },
    		$$scope: { ctx }
    	};

    	content_1 = new Content({ props: content_1_props, $$inline: true });
    	/*content_1_binding*/ ctx[5](content_1);

    	const block = {
    		c: function create() {
    			create_component(content_1.$$.fragment);
    		},
    		l: function claim(nodes) {
    			claim_component(content_1.$$.fragment, nodes);
    		},
    		m: function mount(target, anchor) {
    			mount_component(content_1, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			const content_1_changes = {};

    			if (dirty & /*$$scope, $zen, id, docMD, doc*/ 1053) {
    				content_1_changes.$$scope = { dirty, ctx };
    			}

    			content_1.$set(content_1_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(content_1.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(content_1.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			/*content_1_binding*/ ctx[5](null);
    			destroy_component(content_1, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$6.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$6($$self, $$props, $$invalidate) {
    	let $zen;
    	validate_store(zen, 'zen');
    	component_subscribe($$self, zen, $$value => $$invalidate(3, $zen = $$value));
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Zen', slots, []);
    	let { id } = $$props;
    	collection.set("Zen");
    	document$1.set("");
    	let content;
    	let docMD = "";

    	const getDocMD = async () => {
    		const response = await fetch(`/collections/zen/${id}/document.md`);

    		if (response.status === 404) {
    			navigate("404");
    		} else {
    			const data = await response.text();
    			$$invalidate(2, docMD = Marked.parse(lib(data)));
    			content.gotoStartScrollTop();
    		}
    	};

    	let doc;
    	let docLoaded = false;

    	afterUpdate(() => {
    		if ($zen.length > 0 && !docLoaded) {
    			if (id) {
    				$zen.find(element => {
    					if (element.id === id) {
    						document$1.set(element.title);
    						$$invalidate(4, doc = element);
    						return true;
    					}
    				});

    				getDocMD();
    			} else {
    				document$1.set("");
    				$$invalidate(4, doc = null);
    			}

    			docLoaded = true;
    		}
    	});

    	const writable_props = ['id'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Zen> was created with unknown prop '${key}'`);
    	});

    	function content_1_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			content = $$value;
    			$$invalidate(1, content);
    		});
    	}

    	$$self.$$set = $$props => {
    		if ('id' in $$props) $$invalidate(0, id = $$props.id);
    	};

    	$$self.$capture_state = () => ({
    		afterUpdate,
    		fade,
    		link,
    		navigate,
    		Content,
    		xss: lib,
    		Marked,
    		zen,
    		collection,
    		document: document$1,
    		id,
    		content,
    		docMD,
    		getDocMD,
    		doc,
    		docLoaded,
    		$zen
    	});

    	$$self.$inject_state = $$props => {
    		if ('id' in $$props) $$invalidate(0, id = $$props.id);
    		if ('content' in $$props) $$invalidate(1, content = $$props.content);
    		if ('docMD' in $$props) $$invalidate(2, docMD = $$props.docMD);
    		if ('doc' in $$props) $$invalidate(4, doc = $$props.doc);
    		if ('docLoaded' in $$props) docLoaded = $$props.docLoaded;
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [id, content, docMD, $zen, doc, content_1_binding];
    }

    class Zen extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$6, create_fragment$6, safe_not_equal, { id: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Zen",
    			options,
    			id: create_fragment$6.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*id*/ ctx[0] === undefined && !('id' in props)) {
    			console.warn("<Zen> was created without expected prop 'id'");
    		}
    	}

    	get id() {
    		throw new Error("<Zen>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set id(value) {
    		throw new Error("<Zen>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/routes/DadJokes.svelte generated by Svelte v3.44.1 */
    const file$5 = "src/routes/DadJokes.svelte";

    function get_each_context$3(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[2] = list[i];
    	return child_ctx;
    }

    // (72:2) {#if doc}
    function create_if_block_1$2(ctx) {
    	let div2;
    	let div1;
    	let figure;
    	let iframe;
    	let iframe_src_value;
    	let t0;
    	let div0;
    	let p0;
    	let t1_value = /*doc*/ ctx[2].setup + "";
    	let t1;
    	let t2;
    	let p1;
    	let t3_value = /*doc*/ ctx[2].punchline + "";
    	let t3;
    	let div2_intro;

    	const block = {
    		c: function create() {
    			div2 = element("div");
    			div1 = element("div");
    			figure = element("figure");
    			iframe = element("iframe");
    			t0 = space();
    			div0 = element("div");
    			p0 = element("p");
    			t1 = text(t1_value);
    			t2 = space();
    			p1 = element("p");
    			t3 = text(t3_value);
    			this.h();
    		},
    		l: function claim(nodes) {
    			div2 = claim_element(nodes, "DIV", { class: true });
    			var div2_nodes = children(div2);
    			div1 = claim_element(div2_nodes, "DIV", { class: true });
    			var div1_nodes = children(div1);
    			figure = claim_element(div1_nodes, "FIGURE", { class: true });
    			var figure_nodes = children(figure);

    			iframe = claim_element(figure_nodes, "IFRAME", {
    				src: true,
    				title: true,
    				frameborder: true,
    				allow: true,
    				class: true
    			});

    			children(iframe).forEach(detach_dev);
    			figure_nodes.forEach(detach_dev);
    			t0 = claim_space(div1_nodes);
    			div0 = claim_element(div1_nodes, "DIV", { class: true });
    			var div0_nodes = children(div0);
    			p0 = claim_element(div0_nodes, "P", { class: true });
    			var p0_nodes = children(p0);
    			t1 = claim_text(p0_nodes, t1_value);
    			p0_nodes.forEach(detach_dev);
    			t2 = claim_space(div0_nodes);
    			p1 = claim_element(div0_nodes, "P", { class: true });
    			var p1_nodes = children(p1);
    			t3 = claim_text(p1_nodes, t3_value);
    			p1_nodes.forEach(detach_dev);
    			div0_nodes.forEach(detach_dev);
    			div1_nodes.forEach(detach_dev);
    			div2_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			if (!src_url_equal(iframe.src, iframe_src_value = "https://www.youtube.com/embed/" + /*doc*/ ctx[2].youtube)) attr_dev(iframe, "src", iframe_src_value);
    			attr_dev(iframe, "title", "YouTube video player");
    			attr_dev(iframe, "frameborder", "0");
    			attr_dev(iframe, "allow", "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture");
    			iframe.allowFullscreen = true;
    			attr_dev(iframe, "class", "svelte-13y6ruw");
    			add_location(iframe, file$5, 75, 10, 2330);
    			attr_dev(figure, "class", "m-0 px-10 pt-10 embed-container svelte-13y6ruw");
    			add_location(figure, file$5, 74, 8, 2271);
    			attr_dev(p0, "class", "w-full text-xl md:text-lg px-6 py-6");
    			add_location(p0, file$5, 84, 10, 2679);
    			attr_dev(p1, "class", "w-full text-2xl md:text-lg px-6 py-6");
    			add_location(p1, file$5, 87, 10, 2776);
    			attr_dev(div0, "class", "card-body");
    			add_location(div0, file$5, 83, 8, 2645);
    			attr_dev(div1, "class", "card text-center shadow-2xl sm:w-2/3 md:w-1/2");
    			add_location(div1, file$5, 73, 6, 2203);
    			attr_dev(div2, "class", "container mx-auto w-full flex flex-col items-center pt-4 pb-12");
    			add_location(div2, file$5, 72, 4, 2112);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, div2, anchor);
    			append_hydration_dev(div2, div1);
    			append_hydration_dev(div1, figure);
    			append_hydration_dev(figure, iframe);
    			append_hydration_dev(div1, t0);
    			append_hydration_dev(div1, div0);
    			append_hydration_dev(div0, p0);
    			append_hydration_dev(p0, t1);
    			append_hydration_dev(div0, t2);
    			append_hydration_dev(div0, p1);
    			append_hydration_dev(p1, t3);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*doc*/ 4 && !src_url_equal(iframe.src, iframe_src_value = "https://www.youtube.com/embed/" + /*doc*/ ctx[2].youtube)) {
    				attr_dev(iframe, "src", iframe_src_value);
    			}

    			if (dirty & /*doc*/ 4 && t1_value !== (t1_value = /*doc*/ ctx[2].setup + "")) set_data_dev(t1, t1_value);
    			if (dirty & /*doc*/ 4 && t3_value !== (t3_value = /*doc*/ ctx[2].punchline + "")) set_data_dev(t3, t3_value);
    		},
    		i: function intro(local) {
    			if (!div2_intro) {
    				add_render_callback(() => {
    					div2_intro = create_in_transition(div2, fade, {});
    					div2_intro.start();
    				});
    			}
    		},
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div2);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1$2.name,
    		type: "if",
    		source: "(72:2) {#if doc}",
    		ctx
    	});

    	return block;
    }

    // (37:0) {#if !id}
    function create_if_block$2(ctx) {
    	let div2;
    	let div1;
    	let div0;
    	let t0;
    	let h2;
    	let t1;
    	let h2_intro;
    	let t2;
    	let div2_intro;
    	let each_value = /*$dadJokes*/ ctx[1];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block$3(get_each_context$3(ctx, each_value, i));
    	}

    	const block = {
    		c: function create() {
    			div2 = element("div");
    			div1 = element("div");
    			div0 = element("div");
    			t0 = space();
    			h2 = element("h2");
    			t1 = text("Currated List of Eye Rolling Humor");
    			t2 = space();

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			this.h();
    		},
    		l: function claim(nodes) {
    			div2 = claim_element(nodes, "DIV", { class: true });
    			var div2_nodes = children(div2);
    			div1 = claim_element(div2_nodes, "DIV", { class: true });
    			var div1_nodes = children(div1);
    			div0 = claim_element(div1_nodes, "DIV", { class: true });
    			children(div0).forEach(detach_dev);
    			div1_nodes.forEach(detach_dev);
    			t0 = claim_space(div2_nodes);
    			h2 = claim_element(div2_nodes, "H2", { class: true });
    			var h2_nodes = children(h2);
    			t1 = claim_text(h2_nodes, "Currated List of Eye Rolling Humor");
    			h2_nodes.forEach(detach_dev);
    			t2 = claim_space(div2_nodes);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].l(div2_nodes);
    			}

    			div2_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(div0, "class", "h-1 mx-auto gradient w-64 opacity-25 my-0 py-0 rounded-t");
    			add_location(div0, file$5, 39, 6, 1050);
    			attr_dev(div1, "class", "w-full mb-4");
    			add_location(div1, file$5, 38, 4, 1018);
    			attr_dev(h2, "class", "w-full my-2 text-xl lg:text-2xl font-bold leading-tight text-center");
    			add_location(h2, file$5, 41, 4, 1138);
    			attr_dev(div2, "class", "container mx-auto flex flex-wrap pt-4 pb-12");
    			add_location(div2, file$5, 37, 2, 948);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, div2, anchor);
    			append_hydration_dev(div2, div1);
    			append_hydration_dev(div1, div0);
    			append_hydration_dev(div2, t0);
    			append_hydration_dev(div2, h2);
    			append_hydration_dev(h2, t1);
    			append_hydration_dev(div2, t2);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div2, null);
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*$dadJokes*/ 2) {
    				each_value = /*$dadJokes*/ ctx[1];
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context$3(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    						transition_in(each_blocks[i], 1);
    					} else {
    						each_blocks[i] = create_each_block$3(child_ctx);
    						each_blocks[i].c();
    						transition_in(each_blocks[i], 1);
    						each_blocks[i].m(div2, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}
    		},
    		i: function intro(local) {
    			if (!h2_intro) {
    				add_render_callback(() => {
    					h2_intro = create_in_transition(h2, fade, {});
    					h2_intro.start();
    				});
    			}

    			for (let i = 0; i < each_value.length; i += 1) {
    				transition_in(each_blocks[i]);
    			}

    			if (!div2_intro) {
    				add_render_callback(() => {
    					div2_intro = create_in_transition(div2, fade, {});
    					div2_intro.start();
    				});
    			}
    		},
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div2);
    			destroy_each(each_blocks, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$2.name,
    		type: "if",
    		source: "(37:0) {#if !id}",
    		ctx
    	});

    	return block;
    }

    // (49:4) {#each $dadJokes as doc}
    function create_each_block$3(ctx) {
    	let div3;
    	let div2;
    	let div1;
    	let h2;
    	let t0_value = /*doc*/ ctx[2].title + "";
    	let t0;
    	let t1;
    	let p0;
    	let t2_value = /*doc*/ ctx[2].setup + "";
    	let t2;
    	let t3;
    	let p1;
    	let t4_value = /*doc*/ ctx[2].punchline + "";
    	let t4;
    	let t5;
    	let div0;
    	let a;
    	let t6;
    	let a_href_value;
    	let t7;
    	let figure;
    	let img;
    	let img_alt_value;
    	let img_src_value;
    	let t8;
    	let div3_intro;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			div3 = element("div");
    			div2 = element("div");
    			div1 = element("div");
    			h2 = element("h2");
    			t0 = text(t0_value);
    			t1 = space();
    			p0 = element("p");
    			t2 = text(t2_value);
    			t3 = space();
    			p1 = element("p");
    			t4 = text(t4_value);
    			t5 = space();
    			div0 = element("div");
    			a = element("a");
    			t6 = text("Watch Video");
    			t7 = space();
    			figure = element("figure");
    			img = element("img");
    			t8 = space();
    			this.h();
    		},
    		l: function claim(nodes) {
    			div3 = claim_element(nodes, "DIV", { class: true });
    			var div3_nodes = children(div3);
    			div2 = claim_element(div3_nodes, "DIV", { class: true });
    			var div2_nodes = children(div2);
    			div1 = claim_element(div2_nodes, "DIV", { class: true });
    			var div1_nodes = children(div1);
    			h2 = claim_element(div1_nodes, "H2", { class: true });
    			var h2_nodes = children(h2);
    			t0 = claim_text(h2_nodes, t0_value);
    			h2_nodes.forEach(detach_dev);
    			t1 = claim_space(div1_nodes);
    			p0 = claim_element(div1_nodes, "P", { class: true });
    			var p0_nodes = children(p0);
    			t2 = claim_text(p0_nodes, t2_value);
    			p0_nodes.forEach(detach_dev);
    			t3 = claim_space(div1_nodes);
    			p1 = claim_element(div1_nodes, "P", { class: true });
    			var p1_nodes = children(p1);
    			t4 = claim_text(p1_nodes, t4_value);
    			p1_nodes.forEach(detach_dev);
    			t5 = claim_space(div1_nodes);
    			div0 = claim_element(div1_nodes, "DIV", { class: true });
    			var div0_nodes = children(div0);
    			a = claim_element(div0_nodes, "A", { class: true, href: true });
    			var a_nodes = children(a);
    			t6 = claim_text(a_nodes, "Watch Video");
    			a_nodes.forEach(detach_dev);
    			div0_nodes.forEach(detach_dev);
    			div1_nodes.forEach(detach_dev);
    			t7 = claim_space(div2_nodes);
    			figure = claim_element(div2_nodes, "FIGURE", { class: true });
    			var figure_nodes = children(figure);
    			img = claim_element(figure_nodes, "IMG", { alt: true, src: true });
    			figure_nodes.forEach(detach_dev);
    			div2_nodes.forEach(detach_dev);
    			t8 = claim_space(div3_nodes);
    			div3_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(h2, "class", "card-title");
    			add_location(h2, file$5, 52, 12, 1492);
    			attr_dev(p0, "class", "w-full text-xl md:text-lg px-6 py-6");
    			add_location(p0, file$5, 53, 12, 1544);
    			attr_dev(p1, "class", "w-full text-2xl md:text-lg px-6 py-6");
    			add_location(p1, file$5, 56, 12, 1647);
    			attr_dev(a, "class", "btn btn-primary");
    			attr_dev(a, "href", a_href_value = "dad-jokes/" + /*doc*/ ctx[2].id);
    			add_location(a, file$5, 60, 14, 1796);
    			attr_dev(div0, "class", "card-actions");
    			add_location(div0, file$5, 59, 12, 1755);
    			attr_dev(div1, "class", "card-body");
    			add_location(div1, file$5, 51, 10, 1456);
    			attr_dev(img, "alt", img_alt_value = /*doc*/ ctx[2].title);
    			if (!src_url_equal(img.src, img_src_value = "collections/dad-jokes/image-01.webp")) attr_dev(img, "src", img_src_value);
    			add_location(img, file$5, 64, 12, 1953);
    			attr_dev(figure, "class", "m-0");
    			add_location(figure, file$5, 63, 10, 1920);
    			attr_dev(div2, "class", "card bordered shadow-lg image-full");
    			add_location(div2, file$5, 50, 8, 1397);
    			attr_dev(div3, "class", "flex md:w-1/2 lg:w-1/3 xl:w-1/4 p-2");
    			add_location(div3, file$5, 49, 6, 1331);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, div3, anchor);
    			append_hydration_dev(div3, div2);
    			append_hydration_dev(div2, div1);
    			append_hydration_dev(div1, h2);
    			append_hydration_dev(h2, t0);
    			append_hydration_dev(div1, t1);
    			append_hydration_dev(div1, p0);
    			append_hydration_dev(p0, t2);
    			append_hydration_dev(div1, t3);
    			append_hydration_dev(div1, p1);
    			append_hydration_dev(p1, t4);
    			append_hydration_dev(div1, t5);
    			append_hydration_dev(div1, div0);
    			append_hydration_dev(div0, a);
    			append_hydration_dev(a, t6);
    			append_hydration_dev(div2, t7);
    			append_hydration_dev(div2, figure);
    			append_hydration_dev(figure, img);
    			append_hydration_dev(div3, t8);

    			if (!mounted) {
    				dispose = action_destroyer(link.call(null, a));
    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*$dadJokes*/ 2 && t0_value !== (t0_value = /*doc*/ ctx[2].title + "")) set_data_dev(t0, t0_value);
    			if (dirty & /*$dadJokes*/ 2 && t2_value !== (t2_value = /*doc*/ ctx[2].setup + "")) set_data_dev(t2, t2_value);
    			if (dirty & /*$dadJokes*/ 2 && t4_value !== (t4_value = /*doc*/ ctx[2].punchline + "")) set_data_dev(t4, t4_value);

    			if (dirty & /*$dadJokes*/ 2 && a_href_value !== (a_href_value = "dad-jokes/" + /*doc*/ ctx[2].id)) {
    				attr_dev(a, "href", a_href_value);
    			}

    			if (dirty & /*$dadJokes*/ 2 && img_alt_value !== (img_alt_value = /*doc*/ ctx[2].title)) {
    				attr_dev(img, "alt", img_alt_value);
    			}
    		},
    		i: function intro(local) {
    			if (!div3_intro) {
    				add_render_callback(() => {
    					div3_intro = create_in_transition(div3, fade, {});
    					div3_intro.start();
    				});
    			}
    		},
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div3);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block$3.name,
    		type: "each",
    		source: "(49:4) {#each $dadJokes as doc}",
    		ctx
    	});

    	return block;
    }

    // (35:0) <Content>
    function create_default_slot$4(ctx) {
    	let if_block_anchor;

    	function select_block_type(ctx, dirty) {
    		if (!/*id*/ ctx[0]) return create_if_block$2;
    		if (/*doc*/ ctx[2]) return create_if_block_1$2;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block = current_block_type && current_block_type(ctx);

    	const block = {
    		c: function create() {
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    		},
    		l: function claim(nodes) {
    			if (if_block) if_block.l(nodes);
    			if_block_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			if (if_block) if_block.m(target, anchor);
    			insert_hydration_dev(target, if_block_anchor, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block) {
    				if_block.p(ctx, dirty);
    			} else {
    				if (if_block) if_block.d(1);
    				if_block = current_block_type && current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					transition_in(if_block, 1);
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			}
    		},
    		i: function intro(local) {
    			transition_in(if_block);
    		},
    		o: noop,
    		d: function destroy(detaching) {
    			if (if_block) {
    				if_block.d(detaching);
    			}

    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot$4.name,
    		type: "slot",
    		source: "(35:0) <Content>",
    		ctx
    	});

    	return block;
    }

    function create_fragment$5(ctx) {
    	let content;
    	let current;

    	content = new Content({
    			props: {
    				$$slots: { default: [create_default_slot$4] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(content.$$.fragment);
    		},
    		l: function claim(nodes) {
    			claim_component(content.$$.fragment, nodes);
    		},
    		m: function mount(target, anchor) {
    			mount_component(content, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			const content_changes = {};

    			if (dirty & /*$$scope, $dadJokes, id, doc*/ 71) {
    				content_changes.$$scope = { dirty, ctx };
    			}

    			content.$set(content_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(content.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(content.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(content, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$5.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$5($$self, $$props, $$invalidate) {
    	let $dadJokes;
    	validate_store(dadJokes, 'dadJokes');
    	component_subscribe($$self, dadJokes, $$value => $$invalidate(1, $dadJokes = $$value));
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('DadJokes', slots, []);
    	let { id } = $$props;
    	collection.set("Dad Jokes");
    	document$1.set("");
    	let doc;
    	let docLoaded = false;

    	afterUpdate(() => {
    		if ($dadJokes.length > 0 && !docLoaded) {
    			if (id) {
    				$dadJokes.find(element => {
    					if (element.id === id) {
    						document$1.set(element.title);
    						$$invalidate(2, doc = element);
    						return true;
    					}
    				});

    				if (!doc) {
    					navigate("404");
    				}
    			} else {
    				document$1.set("");
    				$$invalidate(2, doc = null);
    			}

    			docLoaded = true;
    		}
    	});

    	const writable_props = ['id'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<DadJokes> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('id' in $$props) $$invalidate(0, id = $$props.id);
    	};

    	$$self.$capture_state = () => ({
    		afterUpdate,
    		fade,
    		link,
    		navigate,
    		Content,
    		dadJokes,
    		collection,
    		document: document$1,
    		id,
    		doc,
    		docLoaded,
    		$dadJokes
    	});

    	$$self.$inject_state = $$props => {
    		if ('id' in $$props) $$invalidate(0, id = $$props.id);
    		if ('doc' in $$props) $$invalidate(2, doc = $$props.doc);
    		if ('docLoaded' in $$props) docLoaded = $$props.docLoaded;
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [id, $dadJokes, doc];
    }

    class DadJokes extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$5, create_fragment$5, safe_not_equal, { id: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "DadJokes",
    			options,
    			id: create_fragment$5.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*id*/ ctx[0] === undefined && !('id' in props)) {
    			console.warn("<DadJokes> was created without expected prop 'id'");
    		}
    	}

    	get id() {
    		throw new Error("<DadJokes>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set id(value) {
    		throw new Error("<DadJokes>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/routes/Blog.svelte generated by Svelte v3.44.1 */
    const file$4 = "src/routes/Blog.svelte";

    function get_each_context$2(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[4] = list[i];
    	return child_ctx;
    }

    // (80:2) {#if doc}
    function create_if_block_1$1(ctx) {
    	let div2;
    	let div1;
    	let p;
    	let t0_value = /*doc*/ ctx[4].text + "";
    	let t0;
    	let t1;
    	let div0;
    	let div1_intro;

    	const block = {
    		c: function create() {
    			div2 = element("div");
    			div1 = element("div");
    			p = element("p");
    			t0 = text(t0_value);
    			t1 = space();
    			div0 = element("div");
    			this.h();
    		},
    		l: function claim(nodes) {
    			div2 = claim_element(nodes, "DIV", { class: true });
    			var div2_nodes = children(div2);
    			div1 = claim_element(div2_nodes, "DIV", { class: true });
    			var div1_nodes = children(div1);
    			p = claim_element(div1_nodes, "P", { class: true });
    			var p_nodes = children(p);
    			t0 = claim_text(p_nodes, t0_value);
    			p_nodes.forEach(detach_dev);
    			t1 = claim_space(div1_nodes);
    			div0 = claim_element(div1_nodes, "DIV", { class: true });
    			var div0_nodes = children(div0);
    			div0_nodes.forEach(detach_dev);
    			div1_nodes.forEach(detach_dev);
    			div2_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(p, "class", "w-full p-6 space-y-6");
    			add_location(p, file$4, 82, 8, 2521);
    			attr_dev(div0, "class", "w-full p-6 space-y-6");
    			add_location(div0, file$4, 85, 8, 2596);
    			attr_dev(div1, "class", "flex flex-wrap w-full xl:w-1/2 md:w-4/6 sm:w-5/6");
    			add_location(div1, file$4, 81, 6, 2442);
    			attr_dev(div2, "class", "w-full flex flex-col justify-center items-center pt-4");
    			add_location(div2, file$4, 80, 4, 2368);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, div2, anchor);
    			append_hydration_dev(div2, div1);
    			append_hydration_dev(div1, p);
    			append_hydration_dev(p, t0);
    			append_hydration_dev(div1, t1);
    			append_hydration_dev(div1, div0);
    			div0.innerHTML = /*docMD*/ ctx[2];
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*doc*/ 16 && t0_value !== (t0_value = /*doc*/ ctx[4].text + "")) set_data_dev(t0, t0_value);
    			if (dirty & /*docMD*/ 4) div0.innerHTML = /*docMD*/ ctx[2];		},
    		i: function intro(local) {
    			if (!div1_intro) {
    				add_render_callback(() => {
    					div1_intro = create_in_transition(div1, fade, {});
    					div1_intro.start();
    				});
    			}
    		},
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div2);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1$1.name,
    		type: "if",
    		source: "(80:2) {#if doc}",
    		ctx
    	});

    	return block;
    }

    // (50:0) {#if !id}
    function create_if_block$1(ctx) {
    	let div2;
    	let div1;
    	let div0;
    	let t0;
    	let h2;
    	let t1;
    	let h2_intro;
    	let t2;
    	let div2_intro;
    	let each_value = /*$blog*/ ctx[3];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block$2(get_each_context$2(ctx, each_value, i));
    	}

    	const block = {
    		c: function create() {
    			div2 = element("div");
    			div1 = element("div");
    			div0 = element("div");
    			t0 = space();
    			h2 = element("h2");
    			t1 = text("A Collection of My Musings");
    			t2 = space();

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			this.h();
    		},
    		l: function claim(nodes) {
    			div2 = claim_element(nodes, "DIV", { class: true });
    			var div2_nodes = children(div2);
    			div1 = claim_element(div2_nodes, "DIV", { class: true });
    			var div1_nodes = children(div1);
    			div0 = claim_element(div1_nodes, "DIV", { class: true });
    			children(div0).forEach(detach_dev);
    			div1_nodes.forEach(detach_dev);
    			t0 = claim_space(div2_nodes);
    			h2 = claim_element(div2_nodes, "H2", { class: true });
    			var h2_nodes = children(h2);
    			t1 = claim_text(h2_nodes, "A Collection of My Musings");
    			h2_nodes.forEach(detach_dev);
    			t2 = claim_space(div2_nodes);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].l(div2_nodes);
    			}

    			div2_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(div0, "class", "h-1 mx-auto gradient w-64 opacity-25 my-0 py-0 rounded-t");
    			add_location(div0, file$4, 52, 6, 1422);
    			attr_dev(div1, "class", "w-full mb-4");
    			add_location(div1, file$4, 51, 4, 1390);
    			attr_dev(h2, "class", "w-full my-2 text-xl lg:text-2xl font-bold leading-tight text-center");
    			add_location(h2, file$4, 54, 4, 1510);
    			attr_dev(div2, "class", "container mx-auto flex flex-wrap pt-4 pb-12");
    			add_location(div2, file$4, 50, 2, 1320);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, div2, anchor);
    			append_hydration_dev(div2, div1);
    			append_hydration_dev(div1, div0);
    			append_hydration_dev(div2, t0);
    			append_hydration_dev(div2, h2);
    			append_hydration_dev(h2, t1);
    			append_hydration_dev(div2, t2);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div2, null);
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*$blog*/ 8) {
    				each_value = /*$blog*/ ctx[3];
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context$2(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    						transition_in(each_blocks[i], 1);
    					} else {
    						each_blocks[i] = create_each_block$2(child_ctx);
    						each_blocks[i].c();
    						transition_in(each_blocks[i], 1);
    						each_blocks[i].m(div2, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}
    		},
    		i: function intro(local) {
    			if (!h2_intro) {
    				add_render_callback(() => {
    					h2_intro = create_in_transition(h2, fade, {});
    					h2_intro.start();
    				});
    			}

    			for (let i = 0; i < each_value.length; i += 1) {
    				transition_in(each_blocks[i]);
    			}

    			if (!div2_intro) {
    				add_render_callback(() => {
    					div2_intro = create_in_transition(div2, fade, {});
    					div2_intro.start();
    				});
    			}
    		},
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div2);
    			destroy_each(each_blocks, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$1.name,
    		type: "if",
    		source: "(50:0) {#if !id}",
    		ctx
    	});

    	return block;
    }

    // (62:4) {#each $blog as doc}
    function create_each_block$2(ctx) {
    	let div3;
    	let div2;
    	let figure;
    	let img;
    	let img_alt_value;
    	let img_src_value;
    	let t0;
    	let div1;
    	let h2;
    	let t1_value = /*doc*/ ctx[4].title + "";
    	let t1;
    	let t2;
    	let p;
    	let t3_value = /*doc*/ ctx[4].text + "";
    	let t3;
    	let t4;
    	let div0;
    	let a;
    	let t5;
    	let a_href_value;
    	let t6;
    	let div3_intro;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			div3 = element("div");
    			div2 = element("div");
    			figure = element("figure");
    			img = element("img");
    			t0 = space();
    			div1 = element("div");
    			h2 = element("h2");
    			t1 = text(t1_value);
    			t2 = space();
    			p = element("p");
    			t3 = text(t3_value);
    			t4 = space();
    			div0 = element("div");
    			a = element("a");
    			t5 = text("Read More");
    			t6 = space();
    			this.h();
    		},
    		l: function claim(nodes) {
    			div3 = claim_element(nodes, "DIV", { class: true });
    			var div3_nodes = children(div3);
    			div2 = claim_element(div3_nodes, "DIV", { class: true });
    			var div2_nodes = children(div2);
    			figure = claim_element(div2_nodes, "FIGURE", { class: true });
    			var figure_nodes = children(figure);
    			img = claim_element(figure_nodes, "IMG", { class: true, alt: true, src: true });
    			figure_nodes.forEach(detach_dev);
    			t0 = claim_space(div2_nodes);
    			div1 = claim_element(div2_nodes, "DIV", { class: true });
    			var div1_nodes = children(div1);
    			h2 = claim_element(div1_nodes, "H2", { class: true });
    			var h2_nodes = children(h2);
    			t1 = claim_text(h2_nodes, t1_value);
    			h2_nodes.forEach(detach_dev);
    			t2 = claim_space(div1_nodes);
    			p = claim_element(div1_nodes, "P", { class: true });
    			var p_nodes = children(p);
    			t3 = claim_text(p_nodes, t3_value);
    			p_nodes.forEach(detach_dev);
    			t4 = claim_space(div1_nodes);
    			div0 = claim_element(div1_nodes, "DIV", { class: true });
    			var div0_nodes = children(div0);
    			a = claim_element(div0_nodes, "A", { class: true, href: true });
    			var a_nodes = children(a);
    			t5 = claim_text(a_nodes, "Read More");
    			a_nodes.forEach(detach_dev);
    			div0_nodes.forEach(detach_dev);
    			div1_nodes.forEach(detach_dev);
    			div2_nodes.forEach(detach_dev);
    			t6 = claim_space(div3_nodes);
    			div3_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(img, "class", "object-cover h-96 md:h-48 w-full rounded-lg");
    			attr_dev(img, "alt", img_alt_value = /*doc*/ ctx[4].title);
    			if (!src_url_equal(img.src, img_src_value = "collections/blog/" + /*doc*/ ctx[4].id + "/image.webp")) attr_dev(img, "src", img_src_value);
    			add_location(img, file$4, 65, 12, 1850);
    			attr_dev(figure, "class", "m-0 px-10 pt-10");
    			add_location(figure, file$4, 64, 10, 1805);
    			attr_dev(h2, "class", "card-title");
    			add_location(h2, file$4, 68, 12, 2035);
    			attr_dev(p, "class", "sm:text-sm md:text-xs");
    			add_location(p, file$4, 69, 12, 2087);
    			attr_dev(a, "class", "btn btn-primary");
    			attr_dev(a, "href", a_href_value = "blog/" + /*doc*/ ctx[4].id);
    			add_location(a, file$4, 71, 14, 2188);
    			attr_dev(div0, "class", "card-actions");
    			add_location(div0, file$4, 70, 12, 2147);
    			attr_dev(div1, "class", "card-body");
    			add_location(div1, file$4, 67, 10, 1999);
    			attr_dev(div2, "class", "card bordered shadow-lg");
    			add_location(div2, file$4, 63, 8, 1757);
    			attr_dev(div3, "class", "flex md:w-1/2 lg:w-1/3 xl:w-1/4 p-2");
    			add_location(div3, file$4, 62, 6, 1691);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, div3, anchor);
    			append_hydration_dev(div3, div2);
    			append_hydration_dev(div2, figure);
    			append_hydration_dev(figure, img);
    			append_hydration_dev(div2, t0);
    			append_hydration_dev(div2, div1);
    			append_hydration_dev(div1, h2);
    			append_hydration_dev(h2, t1);
    			append_hydration_dev(div1, t2);
    			append_hydration_dev(div1, p);
    			append_hydration_dev(p, t3);
    			append_hydration_dev(div1, t4);
    			append_hydration_dev(div1, div0);
    			append_hydration_dev(div0, a);
    			append_hydration_dev(a, t5);
    			append_hydration_dev(div3, t6);

    			if (!mounted) {
    				dispose = action_destroyer(link.call(null, a));
    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*$blog*/ 8 && img_alt_value !== (img_alt_value = /*doc*/ ctx[4].title)) {
    				attr_dev(img, "alt", img_alt_value);
    			}

    			if (dirty & /*$blog*/ 8 && !src_url_equal(img.src, img_src_value = "collections/blog/" + /*doc*/ ctx[4].id + "/image.webp")) {
    				attr_dev(img, "src", img_src_value);
    			}

    			if (dirty & /*$blog*/ 8 && t1_value !== (t1_value = /*doc*/ ctx[4].title + "")) set_data_dev(t1, t1_value);
    			if (dirty & /*$blog*/ 8 && t3_value !== (t3_value = /*doc*/ ctx[4].text + "")) set_data_dev(t3, t3_value);

    			if (dirty & /*$blog*/ 8 && a_href_value !== (a_href_value = "blog/" + /*doc*/ ctx[4].id)) {
    				attr_dev(a, "href", a_href_value);
    			}
    		},
    		i: function intro(local) {
    			if (!div3_intro) {
    				add_render_callback(() => {
    					div3_intro = create_in_transition(div3, fade, {});
    					div3_intro.start();
    				});
    			}
    		},
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div3);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block$2.name,
    		type: "each",
    		source: "(62:4) {#each $blog as doc}",
    		ctx
    	});

    	return block;
    }

    // (48:0) <Content bind:this={content}>
    function create_default_slot$3(ctx) {
    	let if_block_anchor;

    	function select_block_type(ctx, dirty) {
    		if (!/*id*/ ctx[0]) return create_if_block$1;
    		if (/*doc*/ ctx[4]) return create_if_block_1$1;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block = current_block_type && current_block_type(ctx);

    	const block = {
    		c: function create() {
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    		},
    		l: function claim(nodes) {
    			if (if_block) if_block.l(nodes);
    			if_block_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			if (if_block) if_block.m(target, anchor);
    			insert_hydration_dev(target, if_block_anchor, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block) {
    				if_block.p(ctx, dirty);
    			} else {
    				if (if_block) if_block.d(1);
    				if_block = current_block_type && current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					transition_in(if_block, 1);
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			}
    		},
    		i: function intro(local) {
    			transition_in(if_block);
    		},
    		o: noop,
    		d: function destroy(detaching) {
    			if (if_block) {
    				if_block.d(detaching);
    			}

    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot$3.name,
    		type: "slot",
    		source: "(48:0) <Content bind:this={content}>",
    		ctx
    	});

    	return block;
    }

    function create_fragment$4(ctx) {
    	let content_1;
    	let current;

    	let content_1_props = {
    		$$slots: { default: [create_default_slot$3] },
    		$$scope: { ctx }
    	};

    	content_1 = new Content({ props: content_1_props, $$inline: true });
    	/*content_1_binding*/ ctx[5](content_1);

    	const block = {
    		c: function create() {
    			create_component(content_1.$$.fragment);
    		},
    		l: function claim(nodes) {
    			claim_component(content_1.$$.fragment, nodes);
    		},
    		m: function mount(target, anchor) {
    			mount_component(content_1, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			const content_1_changes = {};

    			if (dirty & /*$$scope, $blog, id, docMD, doc*/ 1053) {
    				content_1_changes.$$scope = { dirty, ctx };
    			}

    			content_1.$set(content_1_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(content_1.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(content_1.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			/*content_1_binding*/ ctx[5](null);
    			destroy_component(content_1, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$4.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$4($$self, $$props, $$invalidate) {
    	let $blog;
    	validate_store(blog, 'blog');
    	component_subscribe($$self, blog, $$value => $$invalidate(3, $blog = $$value));
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Blog', slots, []);
    	let { id } = $$props;
    	collection.set("Blog");
    	document$1.set("");
    	let content;
    	let docMD = "";

    	const getDocument = async () => {
    		const response = await fetch(`/collections/blog/${id}/document.md`);

    		if (response.status === 404) {
    			navigate("404");
    		} else {
    			const data = await response.text();
    			$$invalidate(2, docMD = Marked.parse(lib(data)));
    			content.gotoStartScrollTop();
    		}
    	};

    	let doc;
    	let docLoaded = false;

    	afterUpdate(() => {
    		if ($blog.length > 0 && !docLoaded) {
    			if (id) {
    				$blog.find(element => {
    					if (element.id === id) {
    						document$1.set(element.title);
    						$$invalidate(4, doc = element);
    						return true;
    					}
    				});

    				getDocument();
    			} else {
    				document$1.set("");
    				$$invalidate(4, doc = null);
    			}

    			docLoaded = true;
    		}
    	});

    	const writable_props = ['id'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Blog> was created with unknown prop '${key}'`);
    	});

    	function content_1_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			content = $$value;
    			$$invalidate(1, content);
    		});
    	}

    	$$self.$$set = $$props => {
    		if ('id' in $$props) $$invalidate(0, id = $$props.id);
    	};

    	$$self.$capture_state = () => ({
    		afterUpdate,
    		fade,
    		link,
    		navigate,
    		Content,
    		xss: lib,
    		Marked,
    		blog,
    		collection,
    		document: document$1,
    		id,
    		content,
    		docMD,
    		getDocument,
    		doc,
    		docLoaded,
    		$blog
    	});

    	$$self.$inject_state = $$props => {
    		if ('id' in $$props) $$invalidate(0, id = $$props.id);
    		if ('content' in $$props) $$invalidate(1, content = $$props.content);
    		if ('docMD' in $$props) $$invalidate(2, docMD = $$props.docMD);
    		if ('doc' in $$props) $$invalidate(4, doc = $$props.doc);
    		if ('docLoaded' in $$props) docLoaded = $$props.docLoaded;
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [id, content, docMD, $blog, doc, content_1_binding];
    }

    class Blog extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$4, create_fragment$4, safe_not_equal, { id: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Blog",
    			options,
    			id: create_fragment$4.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*id*/ ctx[0] === undefined && !('id' in props)) {
    			console.warn("<Blog> was created without expected prop 'id'");
    		}
    	}

    	get id() {
    		throw new Error("<Blog>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set id(value) {
    		throw new Error("<Blog>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/routes/Recipes.svelte generated by Svelte v3.44.1 */
    const file$3 = "src/routes/Recipes.svelte";

    function get_each_context$1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[4] = list[i];
    	return child_ctx;
    }

    // (85:2) {#if doc}
    function create_if_block_1(ctx) {
    	let div3;
    	let div2;
    	let div1;
    	let a0;
    	let t0;
    	let a0_href_value;
    	let a0_class_value;
    	let t1;
    	let a1;
    	let t2;
    	let a1_href_value;
    	let a1_class_value;
    	let t3;
    	let a2;
    	let t4;
    	let a2_href_value;
    	let a2_class_value;
    	let t5;
    	let a3;
    	let t6;
    	let a3_href_value;
    	let a3_class_value;
    	let t7;
    	let div0;
    	let t8;
    	let div2_intro;
    	let mounted;
    	let dispose;

    	function select_block_type_1(ctx, dirty) {
    		if (/*tab*/ ctx[1] === "overview") return create_if_block_2;
    		return create_else_block;
    	}

    	let current_block_type = select_block_type_1(ctx);
    	let if_block = current_block_type(ctx);

    	const block = {
    		c: function create() {
    			div3 = element("div");
    			div2 = element("div");
    			div1 = element("div");
    			a0 = element("a");
    			t0 = text("Overview");
    			t1 = space();
    			a1 = element("a");
    			t2 = text("Ingredients");
    			t3 = space();
    			a2 = element("a");
    			t4 = text("Instructions");
    			t5 = space();
    			a3 = element("a");
    			t6 = text("Notes");
    			t7 = space();
    			div0 = element("div");
    			t8 = space();
    			if_block.c();
    			this.h();
    		},
    		l: function claim(nodes) {
    			div3 = claim_element(nodes, "DIV", { class: true });
    			var div3_nodes = children(div3);
    			div2 = claim_element(div3_nodes, "DIV", { class: true });
    			var div2_nodes = children(div2);
    			div1 = claim_element(div2_nodes, "DIV", { class: true });
    			var div1_nodes = children(div1);
    			a0 = claim_element(div1_nodes, "A", { href: true, class: true });
    			var a0_nodes = children(a0);
    			t0 = claim_text(a0_nodes, "Overview");
    			a0_nodes.forEach(detach_dev);
    			t1 = claim_space(div1_nodes);
    			a1 = claim_element(div1_nodes, "A", { href: true, class: true });
    			var a1_nodes = children(a1);
    			t2 = claim_text(a1_nodes, "Ingredients");
    			a1_nodes.forEach(detach_dev);
    			t3 = claim_space(div1_nodes);
    			a2 = claim_element(div1_nodes, "A", { href: true, class: true });
    			var a2_nodes = children(a2);
    			t4 = claim_text(a2_nodes, "Instructions");
    			a2_nodes.forEach(detach_dev);
    			t5 = claim_space(div1_nodes);
    			a3 = claim_element(div1_nodes, "A", { href: true, class: true });
    			var a3_nodes = children(a3);
    			t6 = claim_text(a3_nodes, "Notes");
    			a3_nodes.forEach(detach_dev);
    			t7 = claim_space(div1_nodes);
    			div0 = claim_element(div1_nodes, "DIV", { class: true });
    			children(div0).forEach(detach_dev);
    			div1_nodes.forEach(detach_dev);
    			t8 = claim_space(div2_nodes);
    			if_block.l(div2_nodes);
    			div2_nodes.forEach(detach_dev);
    			div3_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(a0, "href", a0_href_value = "recipes/" + /*doc*/ ctx[4].id + "/overview");
    			attr_dev(a0, "class", a0_class_value = "tab tab-lifted " + (/*tab*/ ctx[1] === 'overview' ? 'tab-active' : ''));
    			add_location(a0, file$3, 88, 10, 2661);
    			attr_dev(a1, "href", a1_href_value = "recipes/" + /*doc*/ ctx[4].id + "/ingredients");
    			attr_dev(a1, "class", a1_class_value = "tab tab-lifted " + (/*tab*/ ctx[1] === 'ingredients' ? 'tab-active' : ''));
    			add_location(a1, file$3, 93, 10, 2840);
    			attr_dev(a2, "href", a2_href_value = "recipes/" + /*doc*/ ctx[4].id + "/instructions");
    			attr_dev(a2, "class", a2_class_value = "tab tab-lifted " + (/*tab*/ ctx[1] === 'instructions' ? 'tab-active' : ''));
    			add_location(a2, file$3, 98, 10, 3028);
    			attr_dev(a3, "href", a3_href_value = "recipes/" + /*doc*/ ctx[4].id + "/notes");
    			attr_dev(a3, "class", a3_class_value = "tab tab-lifted " + (/*tab*/ ctx[1] === 'notes' ? 'tab-active' : ''));
    			add_location(a3, file$3, 105, 10, 3247);
    			attr_dev(div0, "class", "flex-1 cursor-default tab tab-lifted");
    			add_location(div0, file$3, 110, 10, 3417);
    			attr_dev(div1, "class", "tabs w-full");
    			add_location(div1, file$3, 87, 8, 2625);
    			attr_dev(div2, "class", "flex flex-wrap w-full xl:w-1/2 md:w-4/6 sm:w-5/6");
    			add_location(div2, file$3, 86, 6, 2546);
    			attr_dev(div3, "class", "w-full flex flex-col justify-center items-center pt-24");
    			add_location(div3, file$3, 85, 4, 2471);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, div3, anchor);
    			append_hydration_dev(div3, div2);
    			append_hydration_dev(div2, div1);
    			append_hydration_dev(div1, a0);
    			append_hydration_dev(a0, t0);
    			append_hydration_dev(div1, t1);
    			append_hydration_dev(div1, a1);
    			append_hydration_dev(a1, t2);
    			append_hydration_dev(div1, t3);
    			append_hydration_dev(div1, a2);
    			append_hydration_dev(a2, t4);
    			append_hydration_dev(div1, t5);
    			append_hydration_dev(div1, a3);
    			append_hydration_dev(a3, t6);
    			append_hydration_dev(div1, t7);
    			append_hydration_dev(div1, div0);
    			append_hydration_dev(div2, t8);
    			if_block.m(div2, null);

    			if (!mounted) {
    				dispose = [
    					action_destroyer(link.call(null, a0)),
    					action_destroyer(link.call(null, a1)),
    					action_destroyer(link.call(null, a2)),
    					action_destroyer(link.call(null, a3))
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*doc*/ 16 && a0_href_value !== (a0_href_value = "recipes/" + /*doc*/ ctx[4].id + "/overview")) {
    				attr_dev(a0, "href", a0_href_value);
    			}

    			if (dirty & /*tab*/ 2 && a0_class_value !== (a0_class_value = "tab tab-lifted " + (/*tab*/ ctx[1] === 'overview' ? 'tab-active' : ''))) {
    				attr_dev(a0, "class", a0_class_value);
    			}

    			if (dirty & /*doc*/ 16 && a1_href_value !== (a1_href_value = "recipes/" + /*doc*/ ctx[4].id + "/ingredients")) {
    				attr_dev(a1, "href", a1_href_value);
    			}

    			if (dirty & /*tab*/ 2 && a1_class_value !== (a1_class_value = "tab tab-lifted " + (/*tab*/ ctx[1] === 'ingredients' ? 'tab-active' : ''))) {
    				attr_dev(a1, "class", a1_class_value);
    			}

    			if (dirty & /*doc*/ 16 && a2_href_value !== (a2_href_value = "recipes/" + /*doc*/ ctx[4].id + "/instructions")) {
    				attr_dev(a2, "href", a2_href_value);
    			}

    			if (dirty & /*tab*/ 2 && a2_class_value !== (a2_class_value = "tab tab-lifted " + (/*tab*/ ctx[1] === 'instructions' ? 'tab-active' : ''))) {
    				attr_dev(a2, "class", a2_class_value);
    			}

    			if (dirty & /*doc*/ 16 && a3_href_value !== (a3_href_value = "recipes/" + /*doc*/ ctx[4].id + "/notes")) {
    				attr_dev(a3, "href", a3_href_value);
    			}

    			if (dirty & /*tab*/ 2 && a3_class_value !== (a3_class_value = "tab tab-lifted " + (/*tab*/ ctx[1] === 'notes' ? 'tab-active' : ''))) {
    				attr_dev(a3, "class", a3_class_value);
    			}

    			if (current_block_type === (current_block_type = select_block_type_1(ctx)) && if_block) {
    				if_block.p(ctx, dirty);
    			} else {
    				if_block.d(1);
    				if_block = current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					transition_in(if_block, 1);
    					if_block.m(div2, null);
    				}
    			}
    		},
    		i: function intro(local) {
    			transition_in(if_block);

    			if (!div2_intro) {
    				add_render_callback(() => {
    					div2_intro = create_in_transition(div2, fade, {});
    					div2_intro.start();
    				});
    			}
    		},
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div3);
    			if_block.d();
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1.name,
    		type: "if",
    		source: "(85:2) {#if doc}",
    		ctx
    	});

    	return block;
    }

    // (55:0) {#if !id}
    function create_if_block(ctx) {
    	let div2;
    	let div1;
    	let div0;
    	let t0;
    	let h2;
    	let t1;
    	let h2_intro;
    	let t2;
    	let div2_intro;
    	let each_value = /*$recipes*/ ctx[3];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block$1(get_each_context$1(ctx, each_value, i));
    	}

    	const block = {
    		c: function create() {
    			div2 = element("div");
    			div1 = element("div");
    			div0 = element("div");
    			t0 = space();
    			h2 = element("h2");
    			t1 = text("Food I Love to Make");
    			t2 = space();

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			this.h();
    		},
    		l: function claim(nodes) {
    			div2 = claim_element(nodes, "DIV", { class: true });
    			var div2_nodes = children(div2);
    			div1 = claim_element(div2_nodes, "DIV", { class: true });
    			var div1_nodes = children(div1);
    			div0 = claim_element(div1_nodes, "DIV", { class: true });
    			children(div0).forEach(detach_dev);
    			div1_nodes.forEach(detach_dev);
    			t0 = claim_space(div2_nodes);
    			h2 = claim_element(div2_nodes, "H2", { class: true });
    			var h2_nodes = children(h2);
    			t1 = claim_text(h2_nodes, "Food I Love to Make");
    			h2_nodes.forEach(detach_dev);
    			t2 = claim_space(div2_nodes);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].l(div2_nodes);
    			}

    			div2_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(div0, "class", "h-1 mx-auto gradient w-64 opacity-25 my-0 py-0 rounded-t");
    			add_location(div0, file$3, 57, 6, 1521);
    			attr_dev(div1, "class", "w-full mb-4");
    			add_location(div1, file$3, 56, 4, 1489);
    			attr_dev(h2, "class", "w-full my-2 text-xl lg:text-2xl font-bold leading-tight text-center");
    			add_location(h2, file$3, 59, 4, 1609);
    			attr_dev(div2, "class", "container mx-auto flex flex-wrap pt-4 pb-12");
    			add_location(div2, file$3, 55, 2, 1419);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, div2, anchor);
    			append_hydration_dev(div2, div1);
    			append_hydration_dev(div1, div0);
    			append_hydration_dev(div2, t0);
    			append_hydration_dev(div2, h2);
    			append_hydration_dev(h2, t1);
    			append_hydration_dev(div2, t2);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div2, null);
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*$recipes*/ 8) {
    				each_value = /*$recipes*/ ctx[3];
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context$1(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    						transition_in(each_blocks[i], 1);
    					} else {
    						each_blocks[i] = create_each_block$1(child_ctx);
    						each_blocks[i].c();
    						transition_in(each_blocks[i], 1);
    						each_blocks[i].m(div2, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}
    		},
    		i: function intro(local) {
    			if (!h2_intro) {
    				add_render_callback(() => {
    					h2_intro = create_in_transition(h2, fade, {});
    					h2_intro.start();
    				});
    			}

    			for (let i = 0; i < each_value.length; i += 1) {
    				transition_in(each_blocks[i]);
    			}

    			if (!div2_intro) {
    				add_render_callback(() => {
    					div2_intro = create_in_transition(div2, fade, {});
    					div2_intro.start();
    				});
    			}
    		},
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div2);
    			destroy_each(each_blocks, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(55:0) {#if !id}",
    		ctx
    	});

    	return block;
    }

    // (133:8) {:else}
    function create_else_block(ctx) {
    	let div;

    	const block = {
    		c: function create() {
    			div = element("div");
    			this.h();
    		},
    		l: function claim(nodes) {
    			div = claim_element(nodes, "DIV", { class: true });
    			var div_nodes = children(div);
    			div_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(div, "class", "w-full p-6 space-y-6");
    			add_location(div, file$3, 133, 10, 4113);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, div, anchor);
    			div.innerHTML = /*docMD*/ ctx[2];
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*docMD*/ 4) div.innerHTML = /*docMD*/ ctx[2];		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block.name,
    		type: "else",
    		source: "(133:8) {:else}",
    		ctx
    	});

    	return block;
    }

    // (114:8) {#if tab === "overview"}
    function create_if_block_2(ctx) {
    	let div3;
    	let div2;
    	let div0;
    	let p;
    	let t0_value = /*doc*/ ctx[4].text + "";
    	let t0;
    	let t1;
    	let div1;
    	let img;
    	let img_alt_value;
    	let img_src_value;
    	let div2_intro;

    	const block = {
    		c: function create() {
    			div3 = element("div");
    			div2 = element("div");
    			div0 = element("div");
    			p = element("p");
    			t0 = text(t0_value);
    			t1 = space();
    			div1 = element("div");
    			img = element("img");
    			this.h();
    		},
    		l: function claim(nodes) {
    			div3 = claim_element(nodes, "DIV", { class: true });
    			var div3_nodes = children(div3);
    			div2 = claim_element(div3_nodes, "DIV", { class: true });
    			var div2_nodes = children(div2);
    			div0 = claim_element(div2_nodes, "DIV", { class: true });
    			var div0_nodes = children(div0);
    			p = claim_element(div0_nodes, "P", { class: true });
    			var p_nodes = children(p);
    			t0 = claim_text(p_nodes, t0_value);
    			p_nodes.forEach(detach_dev);
    			div0_nodes.forEach(detach_dev);
    			t1 = claim_space(div2_nodes);
    			div1 = claim_element(div2_nodes, "DIV", { class: true });
    			var div1_nodes = children(div1);
    			img = claim_element(div1_nodes, "IMG", { alt: true, src: true });
    			div1_nodes.forEach(detach_dev);
    			div2_nodes.forEach(detach_dev);
    			div3_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(p, "class", "mb-8");
    			add_location(p, file$3, 120, 16, 3756);
    			attr_dev(div0, "class", "w-5/6 sm:w-1/2 p-6");
    			add_location(div0, file$3, 119, 14, 3707);
    			attr_dev(img, "alt", img_alt_value = /*doc*/ ctx[4].title);
    			if (!src_url_equal(img.src, img_src_value = "collections/recipes/" + /*doc*/ ctx[4].id + "/image.webp")) attr_dev(img, "src", img_src_value);
    			add_location(img, file$3, 125, 16, 3908);
    			attr_dev(div1, "class", "w-full sm:w-1/2 p-6");
    			add_location(div1, file$3, 124, 14, 3858);
    			attr_dev(div2, "class", "flex flex-wrap w-full");
    			add_location(div2, file$3, 115, 12, 3608);
    			attr_dev(div3, "class", "w-full flex flex-col justify-center items-center");
    			add_location(div3, file$3, 114, 10, 3533);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, div3, anchor);
    			append_hydration_dev(div3, div2);
    			append_hydration_dev(div2, div0);
    			append_hydration_dev(div0, p);
    			append_hydration_dev(p, t0);
    			append_hydration_dev(div2, t1);
    			append_hydration_dev(div2, div1);
    			append_hydration_dev(div1, img);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*doc*/ 16 && t0_value !== (t0_value = /*doc*/ ctx[4].text + "")) set_data_dev(t0, t0_value);

    			if (dirty & /*doc*/ 16 && img_alt_value !== (img_alt_value = /*doc*/ ctx[4].title)) {
    				attr_dev(img, "alt", img_alt_value);
    			}

    			if (dirty & /*doc*/ 16 && !src_url_equal(img.src, img_src_value = "collections/recipes/" + /*doc*/ ctx[4].id + "/image.webp")) {
    				attr_dev(img, "src", img_src_value);
    			}
    		},
    		i: function intro(local) {
    			if (!div2_intro) {
    				add_render_callback(() => {
    					div2_intro = create_in_transition(div2, fade, {});
    					div2_intro.start();
    				});
    			}
    		},
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div3);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_2.name,
    		type: "if",
    		source: "(114:8) {#if tab === \\\"overview\\\"}",
    		ctx
    	});

    	return block;
    }

    // (67:4) {#each $recipes as doc}
    function create_each_block$1(ctx) {
    	let div3;
    	let div2;
    	let figure;
    	let img;
    	let img_alt_value;
    	let img_src_value;
    	let t0;
    	let div1;
    	let h2;
    	let t1_value = /*doc*/ ctx[4].title + "";
    	let t1;
    	let t2;
    	let p;
    	let t3_value = /*doc*/ ctx[4].text + "";
    	let t3;
    	let t4;
    	let div0;
    	let a;
    	let t5;
    	let a_href_value;
    	let t6;
    	let div3_intro;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			div3 = element("div");
    			div2 = element("div");
    			figure = element("figure");
    			img = element("img");
    			t0 = space();
    			div1 = element("div");
    			h2 = element("h2");
    			t1 = text(t1_value);
    			t2 = space();
    			p = element("p");
    			t3 = text(t3_value);
    			t4 = space();
    			div0 = element("div");
    			a = element("a");
    			t5 = text("Show Recipe");
    			t6 = space();
    			this.h();
    		},
    		l: function claim(nodes) {
    			div3 = claim_element(nodes, "DIV", { class: true });
    			var div3_nodes = children(div3);
    			div2 = claim_element(div3_nodes, "DIV", { class: true });
    			var div2_nodes = children(div2);
    			figure = claim_element(div2_nodes, "FIGURE", { class: true });
    			var figure_nodes = children(figure);
    			img = claim_element(figure_nodes, "IMG", { class: true, alt: true, src: true });
    			figure_nodes.forEach(detach_dev);
    			t0 = claim_space(div2_nodes);
    			div1 = claim_element(div2_nodes, "DIV", { class: true });
    			var div1_nodes = children(div1);
    			h2 = claim_element(div1_nodes, "H2", { class: true });
    			var h2_nodes = children(h2);
    			t1 = claim_text(h2_nodes, t1_value);
    			h2_nodes.forEach(detach_dev);
    			t2 = claim_space(div1_nodes);
    			p = claim_element(div1_nodes, "P", { class: true });
    			var p_nodes = children(p);
    			t3 = claim_text(p_nodes, t3_value);
    			p_nodes.forEach(detach_dev);
    			t4 = claim_space(div1_nodes);
    			div0 = claim_element(div1_nodes, "DIV", { class: true });
    			var div0_nodes = children(div0);
    			a = claim_element(div0_nodes, "A", { class: true, href: true });
    			var a_nodes = children(a);
    			t5 = claim_text(a_nodes, "Show Recipe");
    			a_nodes.forEach(detach_dev);
    			div0_nodes.forEach(detach_dev);
    			div1_nodes.forEach(detach_dev);
    			div2_nodes.forEach(detach_dev);
    			t6 = claim_space(div3_nodes);
    			div3_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(img, "class", "object-cover h-96 md:h-48 w-full rounded-lg");
    			attr_dev(img, "alt", img_alt_value = /*doc*/ ctx[4].title);
    			if (!src_url_equal(img.src, img_src_value = "collections/recipes/" + /*doc*/ ctx[4].id + "/image.webp")) attr_dev(img, "src", img_src_value);
    			add_location(img, file$3, 70, 12, 1945);
    			attr_dev(figure, "class", "m-0 px-10 pt-10");
    			add_location(figure, file$3, 69, 10, 1900);
    			attr_dev(h2, "class", "card-title");
    			add_location(h2, file$3, 73, 12, 2133);
    			attr_dev(p, "class", "sm:text-sm md:text-xs");
    			add_location(p, file$3, 74, 12, 2185);
    			attr_dev(a, "class", "btn btn-primary");
    			attr_dev(a, "href", a_href_value = "recipes/" + /*doc*/ ctx[4].id);
    			add_location(a, file$3, 76, 14, 2286);
    			attr_dev(div0, "class", "card-actions");
    			add_location(div0, file$3, 75, 12, 2245);
    			attr_dev(div1, "class", "card-body");
    			add_location(div1, file$3, 72, 10, 2097);
    			attr_dev(div2, "class", "card bordered shadow-lg");
    			add_location(div2, file$3, 68, 8, 1852);
    			attr_dev(div3, "class", "flex md:w-1/2 lg:w-1/3 xl:w-1/4 p-2");
    			add_location(div3, file$3, 67, 6, 1786);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, div3, anchor);
    			append_hydration_dev(div3, div2);
    			append_hydration_dev(div2, figure);
    			append_hydration_dev(figure, img);
    			append_hydration_dev(div2, t0);
    			append_hydration_dev(div2, div1);
    			append_hydration_dev(div1, h2);
    			append_hydration_dev(h2, t1);
    			append_hydration_dev(div1, t2);
    			append_hydration_dev(div1, p);
    			append_hydration_dev(p, t3);
    			append_hydration_dev(div1, t4);
    			append_hydration_dev(div1, div0);
    			append_hydration_dev(div0, a);
    			append_hydration_dev(a, t5);
    			append_hydration_dev(div3, t6);

    			if (!mounted) {
    				dispose = action_destroyer(link.call(null, a));
    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*$recipes*/ 8 && img_alt_value !== (img_alt_value = /*doc*/ ctx[4].title)) {
    				attr_dev(img, "alt", img_alt_value);
    			}

    			if (dirty & /*$recipes*/ 8 && !src_url_equal(img.src, img_src_value = "collections/recipes/" + /*doc*/ ctx[4].id + "/image.webp")) {
    				attr_dev(img, "src", img_src_value);
    			}

    			if (dirty & /*$recipes*/ 8 && t1_value !== (t1_value = /*doc*/ ctx[4].title + "")) set_data_dev(t1, t1_value);
    			if (dirty & /*$recipes*/ 8 && t3_value !== (t3_value = /*doc*/ ctx[4].text + "")) set_data_dev(t3, t3_value);

    			if (dirty & /*$recipes*/ 8 && a_href_value !== (a_href_value = "recipes/" + /*doc*/ ctx[4].id)) {
    				attr_dev(a, "href", a_href_value);
    			}
    		},
    		i: function intro(local) {
    			if (!div3_intro) {
    				add_render_callback(() => {
    					div3_intro = create_in_transition(div3, fade, {});
    					div3_intro.start();
    				});
    			}
    		},
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div3);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block$1.name,
    		type: "each",
    		source: "(67:4) {#each $recipes as doc}",
    		ctx
    	});

    	return block;
    }

    // (53:0) <Content>
    function create_default_slot$2(ctx) {
    	let if_block_anchor;

    	function select_block_type(ctx, dirty) {
    		if (!/*id*/ ctx[0]) return create_if_block;
    		if (/*doc*/ ctx[4]) return create_if_block_1;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block = current_block_type && current_block_type(ctx);

    	const block = {
    		c: function create() {
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    		},
    		l: function claim(nodes) {
    			if (if_block) if_block.l(nodes);
    			if_block_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			if (if_block) if_block.m(target, anchor);
    			insert_hydration_dev(target, if_block_anchor, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block) {
    				if_block.p(ctx, dirty);
    			} else {
    				if (if_block) if_block.d(1);
    				if_block = current_block_type && current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					transition_in(if_block, 1);
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			}
    		},
    		i: function intro(local) {
    			transition_in(if_block);
    		},
    		o: noop,
    		d: function destroy(detaching) {
    			if (if_block) {
    				if_block.d(detaching);
    			}

    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot$2.name,
    		type: "slot",
    		source: "(53:0) <Content>",
    		ctx
    	});

    	return block;
    }

    function create_fragment$3(ctx) {
    	let content;
    	let current;

    	content = new Content({
    			props: {
    				$$slots: { default: [create_default_slot$2] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(content.$$.fragment);
    		},
    		l: function claim(nodes) {
    			claim_component(content.$$.fragment, nodes);
    		},
    		m: function mount(target, anchor) {
    			mount_component(content, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			const content_changes = {};

    			if (dirty & /*$$scope, $recipes, id, doc, tab, docMD*/ 543) {
    				content_changes.$$scope = { dirty, ctx };
    			}

    			content.$set(content_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(content.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(content.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(content, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$3.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$3($$self, $$props, $$invalidate) {
    	let $recipes;
    	validate_store(recipes, 'recipes');
    	component_subscribe($$self, recipes, $$value => $$invalidate(3, $recipes = $$value));
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Recipes', slots, []);
    	let { id } = $$props;
    	let { tab } = $$props;
    	collection.set("Recipes");
    	document$1.set("");
    	let docMD = "";

    	const getDocument = async () => {
    		const response = await fetch(`/collections/recipes/${id}/${tab}.md`);

    		if (response.status === 404) {
    			navigate("404");
    		} else {
    			const data = await response.text();
    			$$invalidate(2, docMD = Marked.parse(lib(data)));
    		}
    	};

    	let doc;
    	let docLoaded = false;

    	afterUpdate(() => {
    		if ($recipes.length > 0 && !docLoaded) {
    			if (id) {
    				$recipes.find(element => {
    					if (element.id === id) {
    						document$1.set(element.title);
    						$$invalidate(4, doc = element);
    						return true;
    					}
    				});

    				if (tab !== "overview") {
    					getDocument();
    				}
    			} else {
    				document$1.set("");
    				$$invalidate(4, doc = null);
    			}

    			docLoaded = true;
    		}
    	});

    	beforeUpdate(() => {
    		if (docLoaded) docLoaded = false;
    	});

    	const writable_props = ['id', 'tab'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Recipes> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('id' in $$props) $$invalidate(0, id = $$props.id);
    		if ('tab' in $$props) $$invalidate(1, tab = $$props.tab);
    	};

    	$$self.$capture_state = () => ({
    		afterUpdate,
    		beforeUpdate,
    		fade,
    		link,
    		navigate,
    		Content,
    		xss: lib,
    		Marked,
    		recipes,
    		collection,
    		document: document$1,
    		id,
    		tab,
    		docMD,
    		getDocument,
    		doc,
    		docLoaded,
    		$recipes
    	});

    	$$self.$inject_state = $$props => {
    		if ('id' in $$props) $$invalidate(0, id = $$props.id);
    		if ('tab' in $$props) $$invalidate(1, tab = $$props.tab);
    		if ('docMD' in $$props) $$invalidate(2, docMD = $$props.docMD);
    		if ('doc' in $$props) $$invalidate(4, doc = $$props.doc);
    		if ('docLoaded' in $$props) docLoaded = $$props.docLoaded;
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [id, tab, docMD, $recipes, doc];
    }

    class Recipes extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$3, create_fragment$3, safe_not_equal, { id: 0, tab: 1 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Recipes",
    			options,
    			id: create_fragment$3.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*id*/ ctx[0] === undefined && !('id' in props)) {
    			console.warn("<Recipes> was created without expected prop 'id'");
    		}

    		if (/*tab*/ ctx[1] === undefined && !('tab' in props)) {
    			console.warn("<Recipes> was created without expected prop 'tab'");
    		}
    	}

    	get id() {
    		throw new Error("<Recipes>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set id(value) {
    		throw new Error("<Recipes>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get tab() {
    		throw new Error("<Recipes>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set tab(value) {
    		throw new Error("<Recipes>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/routes/Home.svelte generated by Svelte v3.44.1 */
    const file$2 = "src/routes/Home.svelte";

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[6] = list[i];
    	return child_ctx;
    }

    function get_each_context_1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[6] = list[i];
    	return child_ctx;
    }

    function get_each_context_2(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[6] = list[i];
    	return child_ctx;
    }

    function get_each_context_3(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[6] = list[i];
    	return child_ctx;
    }

    // (103:6) {#each $zen.slice(0, 3) as doc}
    function create_each_block_3(ctx) {
    	let div3;
    	let div2;
    	let div1;
    	let h2;
    	let t0_value = /*doc*/ ctx[6].title + "";
    	let t0;
    	let t1;
    	let p;
    	let t2_value = /*doc*/ ctx[6].text + "";
    	let t2;
    	let t3;
    	let div0;
    	let a;
    	let t4;
    	let a_href_value;
    	let t5;
    	let figure;
    	let img;
    	let img_alt_value;
    	let img_src_value;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			div3 = element("div");
    			div2 = element("div");
    			div1 = element("div");
    			h2 = element("h2");
    			t0 = text(t0_value);
    			t1 = space();
    			p = element("p");
    			t2 = text(t2_value);
    			t3 = space();
    			div0 = element("div");
    			a = element("a");
    			t4 = text("Read More");
    			t5 = space();
    			figure = element("figure");
    			img = element("img");
    			this.h();
    		},
    		l: function claim(nodes) {
    			div3 = claim_element(nodes, "DIV", { class: true });
    			var div3_nodes = children(div3);
    			div2 = claim_element(div3_nodes, "DIV", { class: true });
    			var div2_nodes = children(div2);
    			div1 = claim_element(div2_nodes, "DIV", { class: true });
    			var div1_nodes = children(div1);
    			h2 = claim_element(div1_nodes, "H2", { class: true });
    			var h2_nodes = children(h2);
    			t0 = claim_text(h2_nodes, t0_value);
    			h2_nodes.forEach(detach_dev);
    			t1 = claim_space(div1_nodes);
    			p = claim_element(div1_nodes, "P", {});
    			var p_nodes = children(p);
    			t2 = claim_text(p_nodes, t2_value);
    			p_nodes.forEach(detach_dev);
    			t3 = claim_space(div1_nodes);
    			div0 = claim_element(div1_nodes, "DIV", { class: true });
    			var div0_nodes = children(div0);
    			a = claim_element(div0_nodes, "A", { class: true, href: true });
    			var a_nodes = children(a);
    			t4 = claim_text(a_nodes, "Read More");
    			a_nodes.forEach(detach_dev);
    			div0_nodes.forEach(detach_dev);
    			div1_nodes.forEach(detach_dev);
    			t5 = claim_space(div2_nodes);
    			figure = claim_element(div2_nodes, "FIGURE", { class: true });
    			var figure_nodes = children(figure);
    			img = claim_element(figure_nodes, "IMG", { alt: true, src: true });
    			figure_nodes.forEach(detach_dev);
    			div2_nodes.forEach(detach_dev);
    			div3_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(h2, "class", "card-title");
    			add_location(h2, file$2, 106, 14, 3535);
    			add_location(p, file$2, 107, 14, 3589);
    			attr_dev(a, "class", "btn btn-primary");
    			attr_dev(a, "href", a_href_value = "zen/" + /*doc*/ ctx[6].id);
    			add_location(a, file$2, 109, 16, 3664);
    			attr_dev(div0, "class", "card-actions");
    			add_location(div0, file$2, 108, 14, 3621);
    			attr_dev(div1, "class", "card-body");
    			add_location(div1, file$2, 105, 12, 3497);
    			attr_dev(img, "alt", img_alt_value = /*doc*/ ctx[6].title);
    			if (!src_url_equal(img.src, img_src_value = "collections/zen/" + /*doc*/ ctx[6].id + "/image.webp")) attr_dev(img, "src", img_src_value);
    			add_location(img, file$2, 115, 14, 3857);
    			attr_dev(figure, "class", "m-0");
    			add_location(figure, file$2, 114, 12, 3822);
    			attr_dev(div2, "class", "card bordered shadow-lg image-full");
    			add_location(div2, file$2, 104, 10, 3436);
    			attr_dev(div3, "class", "flex md:w-1/2 lg:w-1/3 p-2");
    			add_location(div3, file$2, 103, 8, 3385);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, div3, anchor);
    			append_hydration_dev(div3, div2);
    			append_hydration_dev(div2, div1);
    			append_hydration_dev(div1, h2);
    			append_hydration_dev(h2, t0);
    			append_hydration_dev(div1, t1);
    			append_hydration_dev(div1, p);
    			append_hydration_dev(p, t2);
    			append_hydration_dev(div1, t3);
    			append_hydration_dev(div1, div0);
    			append_hydration_dev(div0, a);
    			append_hydration_dev(a, t4);
    			append_hydration_dev(div2, t5);
    			append_hydration_dev(div2, figure);
    			append_hydration_dev(figure, img);

    			if (!mounted) {
    				dispose = action_destroyer(link.call(null, a));
    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*$zen*/ 1 && t0_value !== (t0_value = /*doc*/ ctx[6].title + "")) set_data_dev(t0, t0_value);
    			if (dirty & /*$zen*/ 1 && t2_value !== (t2_value = /*doc*/ ctx[6].text + "")) set_data_dev(t2, t2_value);

    			if (dirty & /*$zen*/ 1 && a_href_value !== (a_href_value = "zen/" + /*doc*/ ctx[6].id)) {
    				attr_dev(a, "href", a_href_value);
    			}

    			if (dirty & /*$zen*/ 1 && img_alt_value !== (img_alt_value = /*doc*/ ctx[6].title)) {
    				attr_dev(img, "alt", img_alt_value);
    			}

    			if (dirty & /*$zen*/ 1 && !src_url_equal(img.src, img_src_value = "collections/zen/" + /*doc*/ ctx[6].id + "/image.webp")) {
    				attr_dev(img, "src", img_src_value);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div3);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block_3.name,
    		type: "each",
    		source: "(103:6) {#each $zen.slice(0, 3) as doc}",
    		ctx
    	});

    	return block;
    }

    // (197:6) {#each $dadJokes.slice(0, 3) as doc}
    function create_each_block_2(ctx) {
    	let div3;
    	let div2;
    	let div1;
    	let h2;
    	let t0_value = /*doc*/ ctx[6].title + "";
    	let t0;
    	let t1;
    	let p0;
    	let t2_value = /*doc*/ ctx[6].setup + "";
    	let t2;
    	let t3;
    	let p1;
    	let t4_value = /*doc*/ ctx[6].punchline + "";
    	let t4;
    	let t5;
    	let div0;
    	let a;
    	let t6;
    	let a_href_value;
    	let t7;
    	let figure;
    	let img;
    	let img_alt_value;
    	let img_src_value;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			div3 = element("div");
    			div2 = element("div");
    			div1 = element("div");
    			h2 = element("h2");
    			t0 = text(t0_value);
    			t1 = space();
    			p0 = element("p");
    			t2 = text(t2_value);
    			t3 = space();
    			p1 = element("p");
    			t4 = text(t4_value);
    			t5 = space();
    			div0 = element("div");
    			a = element("a");
    			t6 = text("Watch Video");
    			t7 = space();
    			figure = element("figure");
    			img = element("img");
    			this.h();
    		},
    		l: function claim(nodes) {
    			div3 = claim_element(nodes, "DIV", { class: true });
    			var div3_nodes = children(div3);
    			div2 = claim_element(div3_nodes, "DIV", { class: true });
    			var div2_nodes = children(div2);
    			div1 = claim_element(div2_nodes, "DIV", { class: true });
    			var div1_nodes = children(div1);
    			h2 = claim_element(div1_nodes, "H2", { class: true });
    			var h2_nodes = children(h2);
    			t0 = claim_text(h2_nodes, t0_value);
    			h2_nodes.forEach(detach_dev);
    			t1 = claim_space(div1_nodes);
    			p0 = claim_element(div1_nodes, "P", { class: true });
    			var p0_nodes = children(p0);
    			t2 = claim_text(p0_nodes, t2_value);
    			p0_nodes.forEach(detach_dev);
    			t3 = claim_space(div1_nodes);
    			p1 = claim_element(div1_nodes, "P", { class: true });
    			var p1_nodes = children(p1);
    			t4 = claim_text(p1_nodes, t4_value);
    			p1_nodes.forEach(detach_dev);
    			t5 = claim_space(div1_nodes);
    			div0 = claim_element(div1_nodes, "DIV", { class: true });
    			var div0_nodes = children(div0);
    			a = claim_element(div0_nodes, "A", { class: true, href: true });
    			var a_nodes = children(a);
    			t6 = claim_text(a_nodes, "Watch Video");
    			a_nodes.forEach(detach_dev);
    			div0_nodes.forEach(detach_dev);
    			div1_nodes.forEach(detach_dev);
    			t7 = claim_space(div2_nodes);
    			figure = claim_element(div2_nodes, "FIGURE", { class: true });
    			var figure_nodes = children(figure);
    			img = claim_element(figure_nodes, "IMG", { alt: true, src: true });
    			figure_nodes.forEach(detach_dev);
    			div2_nodes.forEach(detach_dev);
    			div3_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(h2, "class", "card-title");
    			add_location(h2, file$2, 200, 14, 6666);
    			attr_dev(p0, "class", "w-full text-xl md:text-lg px-6 py-6");
    			add_location(p0, file$2, 201, 14, 6720);
    			attr_dev(p1, "class", "w-full text-2xl md:text-lg px-6 py-6");
    			add_location(p1, file$2, 204, 14, 6829);
    			attr_dev(a, "class", "btn btn-primary");
    			attr_dev(a, "href", a_href_value = "dad-jokes/" + /*doc*/ ctx[6].id);
    			add_location(a, file$2, 208, 16, 6986);
    			attr_dev(div0, "class", "card-actions");
    			add_location(div0, file$2, 207, 14, 6943);
    			attr_dev(div1, "class", "card-body");
    			add_location(div1, file$2, 199, 12, 6628);
    			attr_dev(img, "alt", img_alt_value = /*doc*/ ctx[6].title);
    			if (!src_url_equal(img.src, img_src_value = "collections/dad-jokes/image-01.webp")) attr_dev(img, "src", img_src_value);
    			add_location(img, file$2, 214, 14, 7187);
    			attr_dev(figure, "class", "m-0");
    			add_location(figure, file$2, 213, 12, 7152);
    			attr_dev(div2, "class", "card bordered shadow-lg image-full");
    			add_location(div2, file$2, 198, 10, 6567);
    			attr_dev(div3, "class", "flex md:w-1/2 lg:w-1/3 p-2");
    			add_location(div3, file$2, 197, 8, 6516);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, div3, anchor);
    			append_hydration_dev(div3, div2);
    			append_hydration_dev(div2, div1);
    			append_hydration_dev(div1, h2);
    			append_hydration_dev(h2, t0);
    			append_hydration_dev(div1, t1);
    			append_hydration_dev(div1, p0);
    			append_hydration_dev(p0, t2);
    			append_hydration_dev(div1, t3);
    			append_hydration_dev(div1, p1);
    			append_hydration_dev(p1, t4);
    			append_hydration_dev(div1, t5);
    			append_hydration_dev(div1, div0);
    			append_hydration_dev(div0, a);
    			append_hydration_dev(a, t6);
    			append_hydration_dev(div2, t7);
    			append_hydration_dev(div2, figure);
    			append_hydration_dev(figure, img);

    			if (!mounted) {
    				dispose = action_destroyer(link.call(null, a));
    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*$dadJokes*/ 2 && t0_value !== (t0_value = /*doc*/ ctx[6].title + "")) set_data_dev(t0, t0_value);
    			if (dirty & /*$dadJokes*/ 2 && t2_value !== (t2_value = /*doc*/ ctx[6].setup + "")) set_data_dev(t2, t2_value);
    			if (dirty & /*$dadJokes*/ 2 && t4_value !== (t4_value = /*doc*/ ctx[6].punchline + "")) set_data_dev(t4, t4_value);

    			if (dirty & /*$dadJokes*/ 2 && a_href_value !== (a_href_value = "dad-jokes/" + /*doc*/ ctx[6].id)) {
    				attr_dev(a, "href", a_href_value);
    			}

    			if (dirty & /*$dadJokes*/ 2 && img_alt_value !== (img_alt_value = /*doc*/ ctx[6].title)) {
    				attr_dev(img, "alt", img_alt_value);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div3);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block_2.name,
    		type: "each",
    		source: "(197:6) {#each $dadJokes.slice(0, 3) as doc}",
    		ctx
    	});

    	return block;
    }

    // (248:6) {#each $blog.slice(0, 3) as doc}
    function create_each_block_1(ctx) {
    	let div3;
    	let div2;
    	let figure;
    	let img;
    	let img_alt_value;
    	let img_src_value;
    	let t0;
    	let div1;
    	let h2;
    	let t1_value = /*doc*/ ctx[6].title + "";
    	let t1;
    	let t2;
    	let p;
    	let t3_value = /*doc*/ ctx[6].text + "";
    	let t3;
    	let t4;
    	let div0;
    	let a;
    	let t5;
    	let a_href_value;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			div3 = element("div");
    			div2 = element("div");
    			figure = element("figure");
    			img = element("img");
    			t0 = space();
    			div1 = element("div");
    			h2 = element("h2");
    			t1 = text(t1_value);
    			t2 = space();
    			p = element("p");
    			t3 = text(t3_value);
    			t4 = space();
    			div0 = element("div");
    			a = element("a");
    			t5 = text("Read More");
    			this.h();
    		},
    		l: function claim(nodes) {
    			div3 = claim_element(nodes, "DIV", { class: true });
    			var div3_nodes = children(div3);
    			div2 = claim_element(div3_nodes, "DIV", { class: true });
    			var div2_nodes = children(div2);
    			figure = claim_element(div2_nodes, "FIGURE", { class: true });
    			var figure_nodes = children(figure);
    			img = claim_element(figure_nodes, "IMG", { class: true, alt: true, src: true });
    			figure_nodes.forEach(detach_dev);
    			t0 = claim_space(div2_nodes);
    			div1 = claim_element(div2_nodes, "DIV", { class: true });
    			var div1_nodes = children(div1);
    			h2 = claim_element(div1_nodes, "H2", { class: true });
    			var h2_nodes = children(h2);
    			t1 = claim_text(h2_nodes, t1_value);
    			h2_nodes.forEach(detach_dev);
    			t2 = claim_space(div1_nodes);
    			p = claim_element(div1_nodes, "P", { class: true });
    			var p_nodes = children(p);
    			t3 = claim_text(p_nodes, t3_value);
    			p_nodes.forEach(detach_dev);
    			t4 = claim_space(div1_nodes);
    			div0 = claim_element(div1_nodes, "DIV", { class: true });
    			var div0_nodes = children(div0);
    			a = claim_element(div0_nodes, "A", { class: true, href: true });
    			var a_nodes = children(a);
    			t5 = claim_text(a_nodes, "Read More");
    			a_nodes.forEach(detach_dev);
    			div0_nodes.forEach(detach_dev);
    			div1_nodes.forEach(detach_dev);
    			div2_nodes.forEach(detach_dev);
    			div3_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(img, "class", "object-cover h-96 md:h-48 w-full rounded-lg");
    			attr_dev(img, "alt", img_alt_value = /*doc*/ ctx[6].title);
    			if (!src_url_equal(img.src, img_src_value = "collections/blog/" + /*doc*/ ctx[6].id + "/image.webp")) attr_dev(img, "src", img_src_value);
    			add_location(img, file$2, 251, 14, 8368);
    			attr_dev(figure, "class", "m-0 px-10 pt-10");
    			add_location(figure, file$2, 250, 12, 8321);
    			attr_dev(h2, "class", "card-title");
    			add_location(h2, file$2, 254, 14, 8559);
    			attr_dev(p, "class", "sm:text-sm md:text-xs");
    			add_location(p, file$2, 255, 14, 8613);
    			attr_dev(a, "class", "btn btn-primary");
    			attr_dev(a, "href", a_href_value = "blog/" + /*doc*/ ctx[6].id);
    			add_location(a, file$2, 257, 16, 8718);
    			attr_dev(div0, "class", "card-actions");
    			add_location(div0, file$2, 256, 14, 8675);
    			attr_dev(div1, "class", "card-body");
    			add_location(div1, file$2, 253, 12, 8521);
    			attr_dev(div2, "class", "card bordered shadow-lg");
    			add_location(div2, file$2, 249, 10, 8271);
    			attr_dev(div3, "class", "flex md:w-1/2 lg:w-1/3 p-2");
    			add_location(div3, file$2, 248, 8, 8220);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, div3, anchor);
    			append_hydration_dev(div3, div2);
    			append_hydration_dev(div2, figure);
    			append_hydration_dev(figure, img);
    			append_hydration_dev(div2, t0);
    			append_hydration_dev(div2, div1);
    			append_hydration_dev(div1, h2);
    			append_hydration_dev(h2, t1);
    			append_hydration_dev(div1, t2);
    			append_hydration_dev(div1, p);
    			append_hydration_dev(p, t3);
    			append_hydration_dev(div1, t4);
    			append_hydration_dev(div1, div0);
    			append_hydration_dev(div0, a);
    			append_hydration_dev(a, t5);

    			if (!mounted) {
    				dispose = action_destroyer(link.call(null, a));
    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*$blog*/ 4 && img_alt_value !== (img_alt_value = /*doc*/ ctx[6].title)) {
    				attr_dev(img, "alt", img_alt_value);
    			}

    			if (dirty & /*$blog*/ 4 && !src_url_equal(img.src, img_src_value = "collections/blog/" + /*doc*/ ctx[6].id + "/image.webp")) {
    				attr_dev(img, "src", img_src_value);
    			}

    			if (dirty & /*$blog*/ 4 && t1_value !== (t1_value = /*doc*/ ctx[6].title + "")) set_data_dev(t1, t1_value);
    			if (dirty & /*$blog*/ 4 && t3_value !== (t3_value = /*doc*/ ctx[6].text + "")) set_data_dev(t3, t3_value);

    			if (dirty & /*$blog*/ 4 && a_href_value !== (a_href_value = "blog/" + /*doc*/ ctx[6].id)) {
    				attr_dev(a, "href", a_href_value);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div3);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block_1.name,
    		type: "each",
    		source: "(248:6) {#each $blog.slice(0, 3) as doc}",
    		ctx
    	});

    	return block;
    }

    // (292:6) {#each $recipes.slice(0, 3) as doc}
    function create_each_block(ctx) {
    	let div3;
    	let div2;
    	let figure;
    	let img;
    	let img_alt_value;
    	let img_src_value;
    	let t0;
    	let div1;
    	let h2;
    	let t1_value = /*doc*/ ctx[6].title + "";
    	let t1;
    	let t2;
    	let p;
    	let t3_value = /*doc*/ ctx[6].text + "";
    	let t3;
    	let t4;
    	let div0;
    	let a;
    	let t5;
    	let a_href_value;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			div3 = element("div");
    			div2 = element("div");
    			figure = element("figure");
    			img = element("img");
    			t0 = space();
    			div1 = element("div");
    			h2 = element("h2");
    			t1 = text(t1_value);
    			t2 = space();
    			p = element("p");
    			t3 = text(t3_value);
    			t4 = space();
    			div0 = element("div");
    			a = element("a");
    			t5 = text("Show Recipe");
    			this.h();
    		},
    		l: function claim(nodes) {
    			div3 = claim_element(nodes, "DIV", { class: true });
    			var div3_nodes = children(div3);
    			div2 = claim_element(div3_nodes, "DIV", { class: true });
    			var div2_nodes = children(div2);
    			figure = claim_element(div2_nodes, "FIGURE", { class: true });
    			var figure_nodes = children(figure);
    			img = claim_element(figure_nodes, "IMG", { class: true, alt: true, src: true });
    			figure_nodes.forEach(detach_dev);
    			t0 = claim_space(div2_nodes);
    			div1 = claim_element(div2_nodes, "DIV", { class: true });
    			var div1_nodes = children(div1);
    			h2 = claim_element(div1_nodes, "H2", { class: true });
    			var h2_nodes = children(h2);
    			t1 = claim_text(h2_nodes, t1_value);
    			h2_nodes.forEach(detach_dev);
    			t2 = claim_space(div1_nodes);
    			p = claim_element(div1_nodes, "P", { class: true });
    			var p_nodes = children(p);
    			t3 = claim_text(p_nodes, t3_value);
    			p_nodes.forEach(detach_dev);
    			t4 = claim_space(div1_nodes);
    			div0 = claim_element(div1_nodes, "DIV", { class: true });
    			var div0_nodes = children(div0);
    			a = claim_element(div0_nodes, "A", { class: true, href: true });
    			var a_nodes = children(a);
    			t5 = claim_text(a_nodes, "Show Recipe");
    			a_nodes.forEach(detach_dev);
    			div0_nodes.forEach(detach_dev);
    			div1_nodes.forEach(detach_dev);
    			div2_nodes.forEach(detach_dev);
    			div3_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(img, "class", "object-cover h-96 md:h-48 w-full rounded-lg");
    			attr_dev(img, "alt", img_alt_value = /*doc*/ ctx[6].title);
    			if (!src_url_equal(img.src, img_src_value = "collections/recipes/" + /*doc*/ ctx[6].id + "/image.webp")) attr_dev(img, "src", img_src_value);
    			add_location(img, file$2, 295, 14, 9917);
    			attr_dev(figure, "class", "m-0 px-10 pt-10");
    			add_location(figure, file$2, 294, 12, 9870);
    			attr_dev(h2, "class", "card-title");
    			add_location(h2, file$2, 298, 14, 10111);
    			attr_dev(p, "class", "sm:text-sm md:text-xs");
    			add_location(p, file$2, 299, 14, 10165);
    			attr_dev(a, "class", "btn btn-primary");
    			attr_dev(a, "href", a_href_value = "recipes/" + /*doc*/ ctx[6].id);
    			add_location(a, file$2, 301, 16, 10270);
    			attr_dev(div0, "class", "card-actions");
    			add_location(div0, file$2, 300, 14, 10227);
    			attr_dev(div1, "class", "card-body");
    			add_location(div1, file$2, 297, 12, 10073);
    			attr_dev(div2, "class", "card bordered shadow-lg");
    			add_location(div2, file$2, 293, 10, 9820);
    			attr_dev(div3, "class", "flex md:w-1/2 lg:w-1/3 p-2");
    			add_location(div3, file$2, 292, 8, 9769);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, div3, anchor);
    			append_hydration_dev(div3, div2);
    			append_hydration_dev(div2, figure);
    			append_hydration_dev(figure, img);
    			append_hydration_dev(div2, t0);
    			append_hydration_dev(div2, div1);
    			append_hydration_dev(div1, h2);
    			append_hydration_dev(h2, t1);
    			append_hydration_dev(div1, t2);
    			append_hydration_dev(div1, p);
    			append_hydration_dev(p, t3);
    			append_hydration_dev(div1, t4);
    			append_hydration_dev(div1, div0);
    			append_hydration_dev(div0, a);
    			append_hydration_dev(a, t5);

    			if (!mounted) {
    				dispose = action_destroyer(link.call(null, a));
    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*$recipes*/ 8 && img_alt_value !== (img_alt_value = /*doc*/ ctx[6].title)) {
    				attr_dev(img, "alt", img_alt_value);
    			}

    			if (dirty & /*$recipes*/ 8 && !src_url_equal(img.src, img_src_value = "collections/recipes/" + /*doc*/ ctx[6].id + "/image.webp")) {
    				attr_dev(img, "src", img_src_value);
    			}

    			if (dirty & /*$recipes*/ 8 && t1_value !== (t1_value = /*doc*/ ctx[6].title + "")) set_data_dev(t1, t1_value);
    			if (dirty & /*$recipes*/ 8 && t3_value !== (t3_value = /*doc*/ ctx[6].text + "")) set_data_dev(t3, t3_value);

    			if (dirty & /*$recipes*/ 8 && a_href_value !== (a_href_value = "recipes/" + /*doc*/ ctx[6].id)) {
    				attr_dev(a, "href", a_href_value);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div3);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block.name,
    		type: "each",
    		source: "(292:6) {#each $recipes.slice(0, 3) as doc}",
    		ctx
    	});

    	return block;
    }

    // (14:0) <Content>
    function create_default_slot$1(ctx) {
    	let div2;
    	let div1;
    	let img0;
    	let img0_src_value;
    	let t0;
    	let div0;
    	let h10;
    	let t1;
    	let t2;
    	let p0;
    	let t3;
    	let t4;
    	let button;
    	let t5;
    	let div2_intro;
    	let t6;
    	let div3;
    	let t7;
    	let t8;
    	let section0;
    	let div16;
    	let a0;
    	let h11;
    	let t9;
    	let t10;
    	let div5;
    	let div4;
    	let t11;
    	let h20;
    	let t12;
    	let t13;
    	let div8;
    	let div7;
    	let img1;
    	let img1_src_value;
    	let t14;
    	let div6;
    	let h30;
    	let t15;
    	let t16;
    	let p1;
    	let t17;
    	let t18;
    	let div11;
    	let div10;
    	let img2;
    	let img2_src_value;
    	let t19;
    	let div9;
    	let h31;
    	let t20;
    	let t21;
    	let p2;
    	let t22;
    	let t23;
    	let div13;
    	let div12;
    	let t24;
    	let h21;
    	let t25;
    	let t26;
    	let div15;
    	let t27;
    	let div14;
    	let a1;
    	let t28;
    	let section0_intro;
    	let t29;
    	let div17;
    	let t30;
    	let t31;
    	let section1;
    	let div30;
    	let a2;
    	let h12;
    	let t32;
    	let t33;
    	let div19;
    	let div18;
    	let t34;
    	let h22;
    	let t35;
    	let t36;
    	let div22;
    	let div21;
    	let img3;
    	let img3_src_value;
    	let t37;
    	let div20;
    	let h32;
    	let t38;
    	let t39;
    	let p3;
    	let t40;
    	let t41;
    	let div25;
    	let div24;
    	let img4;
    	let img4_src_value;
    	let t42;
    	let div23;
    	let h33;
    	let t43;
    	let t44;
    	let p4;
    	let t45;
    	let t46;
    	let div27;
    	let div26;
    	let t47;
    	let h23;
    	let t48;
    	let t49;
    	let div29;
    	let t50;
    	let div28;
    	let a3;
    	let t51;
    	let section1_intro;
    	let t52;
    	let div31;
    	let t53;
    	let t54;
    	let section2;
    	let div36;
    	let a4;
    	let h13;
    	let t55;
    	let t56;
    	let div33;
    	let div32;
    	let t57;
    	let h24;
    	let t58;
    	let t59;
    	let div35;
    	let t60;
    	let div34;
    	let a5;
    	let t61;
    	let section2_intro;
    	let t62;
    	let div37;
    	let t63;
    	let t64;
    	let section3;
    	let div42;
    	let a6;
    	let h14;
    	let t65;
    	let t66;
    	let div39;
    	let div38;
    	let t67;
    	let h25;
    	let t68;
    	let t69;
    	let div41;
    	let t70;
    	let div40;
    	let a7;
    	let t71;
    	let section3_intro;
    	let mounted;
    	let dispose;
    	let each_value_3 = /*$zen*/ ctx[0].slice(0, 3);
    	validate_each_argument(each_value_3);
    	let each_blocks_3 = [];

    	for (let i = 0; i < each_value_3.length; i += 1) {
    		each_blocks_3[i] = create_each_block_3(get_each_context_3(ctx, each_value_3, i));
    	}

    	let each_value_2 = /*$dadJokes*/ ctx[1].slice(0, 3);
    	validate_each_argument(each_value_2);
    	let each_blocks_2 = [];

    	for (let i = 0; i < each_value_2.length; i += 1) {
    		each_blocks_2[i] = create_each_block_2(get_each_context_2(ctx, each_value_2, i));
    	}

    	let each_value_1 = /*$blog*/ ctx[2].slice(0, 3);
    	validate_each_argument(each_value_1);
    	let each_blocks_1 = [];

    	for (let i = 0; i < each_value_1.length; i += 1) {
    		each_blocks_1[i] = create_each_block_1(get_each_context_1(ctx, each_value_1, i));
    	}

    	let each_value = /*$recipes*/ ctx[3].slice(0, 3);
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	const block = {
    		c: function create() {
    			div2 = element("div");
    			div1 = element("div");
    			img0 = element("img");
    			t0 = space();
    			div0 = element("div");
    			h10 = element("h1");
    			t1 = text("Hello there! I'm Greg!");
    			t2 = space();
    			p0 = element("p");
    			t3 = text("Zen Technologist 🧘‍♂️ Teller of Dad Jokes 🤣 Motivating a Mentally\n        Healthier World 🙌");
    			t4 = space();
    			button = element("button");
    			t5 = text("Get to know me");
    			t6 = space();
    			div3 = element("div");
    			t7 = text("Ooohuuummm...");
    			t8 = space();
    			section0 = element("section");
    			div16 = element("div");
    			a0 = element("a");
    			h11 = element("h1");
    			t9 = text("Zen");
    			t10 = space();
    			div5 = element("div");
    			div4 = element("div");
    			t11 = space();
    			h20 = element("h2");
    			t12 = text("Postive Motivation for a Troubled World");
    			t13 = space();
    			div8 = element("div");
    			div7 = element("div");
    			img1 = element("img");
    			t14 = space();
    			div6 = element("div");
    			h30 = element("h3");
    			t15 = text("The Path to Balance");
    			t16 = space();
    			p1 = element("p");
    			t17 = text("Most days I begin my day by building a fresh and unique Zen garden\n            design. I conclude my day by resetting the Zen garden to clear my\n            mind. Weekdays, I feature my Zen garden on social media along with\n            an inspirational quote or motivational statement.");
    			t18 = space();
    			div11 = element("div");
    			div10 = element("div");
    			img2 = element("img");
    			t19 = space();
    			div9 = element("div");
    			h31 = element("h3");
    			t20 = text("Connect with the Moment");
    			t21 = space();
    			p2 = element("p");
    			t22 = text("My desktop Zen garden often features items I have collected on my\n            life's journey. For example, this dish with a tree is a reminder\n            of a wonderful trip I took to the Walt Disney World Resort in\n            Central Florida.");
    			t23 = space();
    			div13 = element("div");
    			div12 = element("div");
    			t24 = space();
    			h21 = element("h2");
    			t25 = text("My Latest Zen Writings");
    			t26 = space();
    			div15 = element("div");

    			for (let i = 0; i < each_blocks_3.length; i += 1) {
    				each_blocks_3[i].c();
    			}

    			t27 = space();
    			div14 = element("div");
    			a1 = element("a");
    			t28 = text("More Zen");
    			t29 = space();
    			div17 = element("div");
    			t30 = text("...but wait! There's more!");
    			t31 = space();
    			section1 = element("section");
    			div30 = element("div");
    			a2 = element("a");
    			h12 = element("h1");
    			t32 = text("Dad Jokes");
    			t33 = space();
    			div19 = element("div");
    			div18 = element("div");
    			t34 = space();
    			h22 = element("h2");
    			t35 = text("Currated List of Eye Rolling Humor");
    			t36 = space();
    			div22 = element("div");
    			div21 = element("div");
    			img3 = element("img");
    			t37 = space();
    			div20 = element("div");
    			h32 = element("h3");
    			t38 = text("Like Father Like Son");
    			t39 = space();
    			p3 = element("p");
    			t40 = text("I grew up hearing dad jokes all the time. And my father would tell\n            me some great ones! When I became a father, I carried on the\n            tradition of telling dad jokes to my son. In fact, that was my\n            motivation for being a father 😏");
    			t41 = space();
    			div25 = element("div");
    			div24 = element("div");
    			img4 = element("img");
    			t42 = space();
    			div23 = element("div");
    			h33 = element("h3");
    			t43 = text("Proud to be a Dad");
    			t44 = space();
    			p4 = element("p");
    			t45 = text("In all seriousness, though, I am quite proud to be a dad and very\n            proud of the man my son is becoming. Now that he is rolling his\n            eyes at my jokes, I share them with the world!");
    			t46 = space();
    			div27 = element("div");
    			div26 = element("div");
    			t47 = space();
    			h23 = element("h2");
    			t48 = text("The Latest Dad Jokes with Greg Marine");
    			t49 = space();
    			div29 = element("div");

    			for (let i = 0; i < each_blocks_2.length; i += 1) {
    				each_blocks_2[i].c();
    			}

    			t50 = space();
    			div28 = element("div");
    			a3 = element("a");
    			t51 = text("More Eye Rolls");
    			t52 = space();
    			div31 = element("div");
    			t53 = text("Still here? Enjoy reading?");
    			t54 = space();
    			section2 = element("section");
    			div36 = element("div");
    			a4 = element("a");
    			h13 = element("h1");
    			t55 = text("Blog");
    			t56 = space();
    			div33 = element("div");
    			div32 = element("div");
    			t57 = space();
    			h24 = element("h2");
    			t58 = text("The Latest in the Collection of My Musings");
    			t59 = space();
    			div35 = element("div");

    			for (let i = 0; i < each_blocks_1.length; i += 1) {
    				each_blocks_1[i].c();
    			}

    			t60 = space();
    			div34 = element("div");
    			a5 = element("a");
    			t61 = text("More Musings");
    			t62 = space();
    			div37 = element("div");
    			t63 = text("Before you leave 👇👇👇 😋 Some Yum!");
    			t64 = space();
    			section3 = element("section");
    			div42 = element("div");
    			a6 = element("a");
    			h14 = element("h1");
    			t65 = text("Recipes");
    			t66 = space();
    			div39 = element("div");
    			div38 = element("div");
    			t67 = space();
    			h25 = element("h2");
    			t68 = text("Food I Love to Make");
    			t69 = space();
    			div41 = element("div");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t70 = space();
    			div40 = element("div");
    			a7 = element("a");
    			t71 = text("More Yum");
    			this.h();
    		},
    		l: function claim(nodes) {
    			div2 = claim_element(nodes, "DIV", { id: true, class: true });
    			var div2_nodes = children(div2);
    			div1 = claim_element(div2_nodes, "DIV", { class: true });
    			var div1_nodes = children(div1);
    			img0 = claim_element(div1_nodes, "IMG", { alt: true, class: true, src: true });
    			t0 = claim_space(div1_nodes);
    			div0 = claim_element(div1_nodes, "DIV", {});
    			var div0_nodes = children(div0);
    			h10 = claim_element(div0_nodes, "H1", { class: true });
    			var h10_nodes = children(h10);
    			t1 = claim_text(h10_nodes, "Hello there! I'm Greg!");
    			h10_nodes.forEach(detach_dev);
    			t2 = claim_space(div0_nodes);
    			p0 = claim_element(div0_nodes, "P", { class: true });
    			var p0_nodes = children(p0);
    			t3 = claim_text(p0_nodes, "Zen Technologist 🧘‍♂️ Teller of Dad Jokes 🤣 Motivating a Mentally\n        Healthier World 🙌");
    			p0_nodes.forEach(detach_dev);
    			t4 = claim_space(div0_nodes);
    			button = claim_element(div0_nodes, "BUTTON", { class: true });
    			var button_nodes = children(button);
    			t5 = claim_text(button_nodes, "Get to know me");
    			button_nodes.forEach(detach_dev);
    			div0_nodes.forEach(detach_dev);
    			div1_nodes.forEach(detach_dev);
    			div2_nodes.forEach(detach_dev);
    			t6 = claim_space(nodes);
    			div3 = claim_element(nodes, "DIV", { class: true });
    			var div3_nodes = children(div3);
    			t7 = claim_text(div3_nodes, "Ooohuuummm...");
    			div3_nodes.forEach(detach_dev);
    			t8 = claim_space(nodes);
    			section0 = claim_element(nodes, "SECTION", { id: true, class: true });
    			var section0_nodes = children(section0);
    			div16 = claim_element(section0_nodes, "DIV", { class: true });
    			var div16_nodes = children(div16);
    			a0 = claim_element(div16_nodes, "A", { href: true, class: true });
    			var a0_nodes = children(a0);
    			h11 = claim_element(a0_nodes, "H1", { class: true });
    			var h11_nodes = children(h11);
    			t9 = claim_text(h11_nodes, "Zen");
    			h11_nodes.forEach(detach_dev);
    			a0_nodes.forEach(detach_dev);
    			t10 = claim_space(div16_nodes);
    			div5 = claim_element(div16_nodes, "DIV", { class: true });
    			var div5_nodes = children(div5);
    			div4 = claim_element(div5_nodes, "DIV", { class: true });
    			children(div4).forEach(detach_dev);
    			div5_nodes.forEach(detach_dev);
    			t11 = claim_space(div16_nodes);
    			h20 = claim_element(div16_nodes, "H2", { class: true });
    			var h20_nodes = children(h20);
    			t12 = claim_text(h20_nodes, "Postive Motivation for a Troubled World");
    			h20_nodes.forEach(detach_dev);
    			t13 = claim_space(div16_nodes);
    			div8 = claim_element(div16_nodes, "DIV", { class: true });
    			var div8_nodes = children(div8);
    			div7 = claim_element(div8_nodes, "DIV", { class: true });
    			var div7_nodes = children(div7);
    			img1 = claim_element(div7_nodes, "IMG", { alt: true, class: true, src: true });
    			t14 = claim_space(div7_nodes);
    			div6 = claim_element(div7_nodes, "DIV", {});
    			var div6_nodes = children(div6);
    			h30 = claim_element(div6_nodes, "H3", { class: true });
    			var h30_nodes = children(h30);
    			t15 = claim_text(h30_nodes, "The Path to Balance");
    			h30_nodes.forEach(detach_dev);
    			t16 = claim_space(div6_nodes);
    			p1 = claim_element(div6_nodes, "P", { class: true });
    			var p1_nodes = children(p1);
    			t17 = claim_text(p1_nodes, "Most days I begin my day by building a fresh and unique Zen garden\n            design. I conclude my day by resetting the Zen garden to clear my\n            mind. Weekdays, I feature my Zen garden on social media along with\n            an inspirational quote or motivational statement.");
    			p1_nodes.forEach(detach_dev);
    			div6_nodes.forEach(detach_dev);
    			div7_nodes.forEach(detach_dev);
    			div8_nodes.forEach(detach_dev);
    			t18 = claim_space(div16_nodes);
    			div11 = claim_element(div16_nodes, "DIV", { class: true });
    			var div11_nodes = children(div11);
    			div10 = claim_element(div11_nodes, "DIV", { class: true });
    			var div10_nodes = children(div10);
    			img2 = claim_element(div10_nodes, "IMG", { alt: true, class: true, src: true });
    			t19 = claim_space(div10_nodes);
    			div9 = claim_element(div10_nodes, "DIV", {});
    			var div9_nodes = children(div9);
    			h31 = claim_element(div9_nodes, "H3", { class: true });
    			var h31_nodes = children(h31);
    			t20 = claim_text(h31_nodes, "Connect with the Moment");
    			h31_nodes.forEach(detach_dev);
    			t21 = claim_space(div9_nodes);
    			p2 = claim_element(div9_nodes, "P", { class: true });
    			var p2_nodes = children(p2);
    			t22 = claim_text(p2_nodes, "My desktop Zen garden often features items I have collected on my\n            life's journey. For example, this dish with a tree is a reminder\n            of a wonderful trip I took to the Walt Disney World Resort in\n            Central Florida.");
    			p2_nodes.forEach(detach_dev);
    			div9_nodes.forEach(detach_dev);
    			div10_nodes.forEach(detach_dev);
    			div11_nodes.forEach(detach_dev);
    			t23 = claim_space(div16_nodes);
    			div13 = claim_element(div16_nodes, "DIV", { class: true });
    			var div13_nodes = children(div13);
    			div12 = claim_element(div13_nodes, "DIV", { class: true });
    			children(div12).forEach(detach_dev);
    			div13_nodes.forEach(detach_dev);
    			t24 = claim_space(div16_nodes);
    			h21 = claim_element(div16_nodes, "H2", { class: true });
    			var h21_nodes = children(h21);
    			t25 = claim_text(h21_nodes, "My Latest Zen Writings");
    			h21_nodes.forEach(detach_dev);
    			t26 = claim_space(div16_nodes);
    			div15 = claim_element(div16_nodes, "DIV", { class: true });
    			var div15_nodes = children(div15);

    			for (let i = 0; i < each_blocks_3.length; i += 1) {
    				each_blocks_3[i].l(div15_nodes);
    			}

    			t27 = claim_space(div15_nodes);
    			div14 = claim_element(div15_nodes, "DIV", { class: true });
    			var div14_nodes = children(div14);
    			a1 = claim_element(div14_nodes, "A", { class: true, href: true });
    			var a1_nodes = children(a1);
    			t28 = claim_text(a1_nodes, "More Zen");
    			a1_nodes.forEach(detach_dev);
    			div14_nodes.forEach(detach_dev);
    			div15_nodes.forEach(detach_dev);
    			div16_nodes.forEach(detach_dev);
    			section0_nodes.forEach(detach_dev);
    			t29 = claim_space(nodes);
    			div17 = claim_element(nodes, "DIV", { class: true });
    			var div17_nodes = children(div17);
    			t30 = claim_text(div17_nodes, "...but wait! There's more!");
    			div17_nodes.forEach(detach_dev);
    			t31 = claim_space(nodes);
    			section1 = claim_element(nodes, "SECTION", { id: true, class: true });
    			var section1_nodes = children(section1);
    			div30 = claim_element(section1_nodes, "DIV", { class: true });
    			var div30_nodes = children(div30);
    			a2 = claim_element(div30_nodes, "A", { href: true, class: true });
    			var a2_nodes = children(a2);
    			h12 = claim_element(a2_nodes, "H1", { class: true });
    			var h12_nodes = children(h12);
    			t32 = claim_text(h12_nodes, "Dad Jokes");
    			h12_nodes.forEach(detach_dev);
    			a2_nodes.forEach(detach_dev);
    			t33 = claim_space(div30_nodes);
    			div19 = claim_element(div30_nodes, "DIV", { class: true });
    			var div19_nodes = children(div19);
    			div18 = claim_element(div19_nodes, "DIV", { class: true });
    			children(div18).forEach(detach_dev);
    			div19_nodes.forEach(detach_dev);
    			t34 = claim_space(div30_nodes);
    			h22 = claim_element(div30_nodes, "H2", { class: true });
    			var h22_nodes = children(h22);
    			t35 = claim_text(h22_nodes, "Currated List of Eye Rolling Humor");
    			h22_nodes.forEach(detach_dev);
    			t36 = claim_space(div30_nodes);
    			div22 = claim_element(div30_nodes, "DIV", { class: true });
    			var div22_nodes = children(div22);
    			div21 = claim_element(div22_nodes, "DIV", { class: true });
    			var div21_nodes = children(div21);
    			img3 = claim_element(div21_nodes, "IMG", { alt: true, class: true, src: true });
    			t37 = claim_space(div21_nodes);
    			div20 = claim_element(div21_nodes, "DIV", {});
    			var div20_nodes = children(div20);
    			h32 = claim_element(div20_nodes, "H3", { class: true });
    			var h32_nodes = children(h32);
    			t38 = claim_text(h32_nodes, "Like Father Like Son");
    			h32_nodes.forEach(detach_dev);
    			t39 = claim_space(div20_nodes);
    			p3 = claim_element(div20_nodes, "P", { class: true });
    			var p3_nodes = children(p3);
    			t40 = claim_text(p3_nodes, "I grew up hearing dad jokes all the time. And my father would tell\n            me some great ones! When I became a father, I carried on the\n            tradition of telling dad jokes to my son. In fact, that was my\n            motivation for being a father 😏");
    			p3_nodes.forEach(detach_dev);
    			div20_nodes.forEach(detach_dev);
    			div21_nodes.forEach(detach_dev);
    			div22_nodes.forEach(detach_dev);
    			t41 = claim_space(div30_nodes);
    			div25 = claim_element(div30_nodes, "DIV", { class: true });
    			var div25_nodes = children(div25);
    			div24 = claim_element(div25_nodes, "DIV", { class: true });
    			var div24_nodes = children(div24);
    			img4 = claim_element(div24_nodes, "IMG", { alt: true, class: true, src: true });
    			t42 = claim_space(div24_nodes);
    			div23 = claim_element(div24_nodes, "DIV", {});
    			var div23_nodes = children(div23);
    			h33 = claim_element(div23_nodes, "H3", { class: true });
    			var h33_nodes = children(h33);
    			t43 = claim_text(h33_nodes, "Proud to be a Dad");
    			h33_nodes.forEach(detach_dev);
    			t44 = claim_space(div23_nodes);
    			p4 = claim_element(div23_nodes, "P", { class: true });
    			var p4_nodes = children(p4);
    			t45 = claim_text(p4_nodes, "In all seriousness, though, I am quite proud to be a dad and very\n            proud of the man my son is becoming. Now that he is rolling his\n            eyes at my jokes, I share them with the world!");
    			p4_nodes.forEach(detach_dev);
    			div23_nodes.forEach(detach_dev);
    			div24_nodes.forEach(detach_dev);
    			div25_nodes.forEach(detach_dev);
    			t46 = claim_space(div30_nodes);
    			div27 = claim_element(div30_nodes, "DIV", { class: true });
    			var div27_nodes = children(div27);
    			div26 = claim_element(div27_nodes, "DIV", { class: true });
    			children(div26).forEach(detach_dev);
    			div27_nodes.forEach(detach_dev);
    			t47 = claim_space(div30_nodes);
    			h23 = claim_element(div30_nodes, "H2", { class: true });
    			var h23_nodes = children(h23);
    			t48 = claim_text(h23_nodes, "The Latest Dad Jokes with Greg Marine");
    			h23_nodes.forEach(detach_dev);
    			t49 = claim_space(div30_nodes);
    			div29 = claim_element(div30_nodes, "DIV", { class: true });
    			var div29_nodes = children(div29);

    			for (let i = 0; i < each_blocks_2.length; i += 1) {
    				each_blocks_2[i].l(div29_nodes);
    			}

    			t50 = claim_space(div29_nodes);
    			div28 = claim_element(div29_nodes, "DIV", { class: true });
    			var div28_nodes = children(div28);
    			a3 = claim_element(div28_nodes, "A", { class: true, href: true });
    			var a3_nodes = children(a3);
    			t51 = claim_text(a3_nodes, "More Eye Rolls");
    			a3_nodes.forEach(detach_dev);
    			div28_nodes.forEach(detach_dev);
    			div29_nodes.forEach(detach_dev);
    			div30_nodes.forEach(detach_dev);
    			section1_nodes.forEach(detach_dev);
    			t52 = claim_space(nodes);
    			div31 = claim_element(nodes, "DIV", { class: true });
    			var div31_nodes = children(div31);
    			t53 = claim_text(div31_nodes, "Still here? Enjoy reading?");
    			div31_nodes.forEach(detach_dev);
    			t54 = claim_space(nodes);
    			section2 = claim_element(nodes, "SECTION", { id: true, class: true });
    			var section2_nodes = children(section2);
    			div36 = claim_element(section2_nodes, "DIV", { class: true });
    			var div36_nodes = children(div36);
    			a4 = claim_element(div36_nodes, "A", { href: true, class: true });
    			var a4_nodes = children(a4);
    			h13 = claim_element(a4_nodes, "H1", { class: true });
    			var h13_nodes = children(h13);
    			t55 = claim_text(h13_nodes, "Blog");
    			h13_nodes.forEach(detach_dev);
    			a4_nodes.forEach(detach_dev);
    			t56 = claim_space(div36_nodes);
    			div33 = claim_element(div36_nodes, "DIV", { class: true });
    			var div33_nodes = children(div33);
    			div32 = claim_element(div33_nodes, "DIV", { class: true });
    			children(div32).forEach(detach_dev);
    			div33_nodes.forEach(detach_dev);
    			t57 = claim_space(div36_nodes);
    			h24 = claim_element(div36_nodes, "H2", { class: true });
    			var h24_nodes = children(h24);
    			t58 = claim_text(h24_nodes, "The Latest in the Collection of My Musings");
    			h24_nodes.forEach(detach_dev);
    			t59 = claim_space(div36_nodes);
    			div35 = claim_element(div36_nodes, "DIV", { class: true });
    			var div35_nodes = children(div35);

    			for (let i = 0; i < each_blocks_1.length; i += 1) {
    				each_blocks_1[i].l(div35_nodes);
    			}

    			t60 = claim_space(div35_nodes);
    			div34 = claim_element(div35_nodes, "DIV", { class: true });
    			var div34_nodes = children(div34);
    			a5 = claim_element(div34_nodes, "A", { class: true, href: true });
    			var a5_nodes = children(a5);
    			t61 = claim_text(a5_nodes, "More Musings");
    			a5_nodes.forEach(detach_dev);
    			div34_nodes.forEach(detach_dev);
    			div35_nodes.forEach(detach_dev);
    			div36_nodes.forEach(detach_dev);
    			section2_nodes.forEach(detach_dev);
    			t62 = claim_space(nodes);
    			div37 = claim_element(nodes, "DIV", { class: true });
    			var div37_nodes = children(div37);
    			t63 = claim_text(div37_nodes, "Before you leave 👇👇👇 😋 Some Yum!");
    			div37_nodes.forEach(detach_dev);
    			t64 = claim_space(nodes);
    			section3 = claim_element(nodes, "SECTION", { id: true, class: true });
    			var section3_nodes = children(section3);
    			div42 = claim_element(section3_nodes, "DIV", { class: true });
    			var div42_nodes = children(div42);
    			a6 = claim_element(div42_nodes, "A", { href: true, class: true });
    			var a6_nodes = children(a6);
    			h14 = claim_element(a6_nodes, "H1", { class: true });
    			var h14_nodes = children(h14);
    			t65 = claim_text(h14_nodes, "Recipes");
    			h14_nodes.forEach(detach_dev);
    			a6_nodes.forEach(detach_dev);
    			t66 = claim_space(div42_nodes);
    			div39 = claim_element(div42_nodes, "DIV", { class: true });
    			var div39_nodes = children(div39);
    			div38 = claim_element(div39_nodes, "DIV", { class: true });
    			children(div38).forEach(detach_dev);
    			div39_nodes.forEach(detach_dev);
    			t67 = claim_space(div42_nodes);
    			h25 = claim_element(div42_nodes, "H2", { class: true });
    			var h25_nodes = children(h25);
    			t68 = claim_text(h25_nodes, "Food I Love to Make");
    			h25_nodes.forEach(detach_dev);
    			t69 = claim_space(div42_nodes);
    			div41 = claim_element(div42_nodes, "DIV", { class: true });
    			var div41_nodes = children(div41);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].l(div41_nodes);
    			}

    			t70 = claim_space(div41_nodes);
    			div40 = claim_element(div41_nodes, "DIV", { class: true });
    			var div40_nodes = children(div40);
    			a7 = claim_element(div40_nodes, "A", { class: true, href: true });
    			var a7_nodes = children(a7);
    			t71 = claim_text(a7_nodes, "More Yum");
    			a7_nodes.forEach(detach_dev);
    			div40_nodes.forEach(detach_dev);
    			div41_nodes.forEach(detach_dev);
    			div42_nodes.forEach(detach_dev);
    			section3_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(img0, "alt", "Greg Marine headshot");
    			attr_dev(img0, "class", "max-w-sm mask mask-squircle");
    			if (!src_url_equal(img0.src, img0_src_value = "profile.webp")) attr_dev(img0, "src", img0_src_value);
    			add_location(img0, file$2, 18, 4, 603);
    			attr_dev(h10, "class", "mb-5 text-5xl font-bold");
    			add_location(h10, file$2, 24, 6, 731);
    			attr_dev(p0, "class", "mb-5");
    			add_location(p0, file$2, 25, 6, 801);
    			attr_dev(button, "class", "btn btn-primary");
    			add_location(button, file$2, 29, 6, 938);
    			add_location(div0, file$2, 23, 4, 719);
    			attr_dev(div1, "class", "flex-col hero-content lg:flex-row-reverse");
    			add_location(div1, file$2, 17, 2, 543);
    			attr_dev(div2, "id", "home");
    			attr_dev(div2, "class", "hero min-h-screen");
    			add_location(div2, file$2, 16, 0, 491);
    			attr_dev(div3, "class", "divider");
    			add_location(div3, file$2, 36, 0, 1073);
    			attr_dev(h11, "class", "w-full my-2 text-5xl font-bold leading-tight text-center");
    			add_location(h11, file$2, 42, 6, 1295);
    			attr_dev(a0, "href", "zen");
    			attr_dev(a0, "class", "w-full no-underline hover:no-underline");
    			add_location(a0, file$2, 41, 4, 1218);
    			attr_dev(div4, "class", "h-1 mx-auto gradient w-64 opacity-25 my-0 py-0 rounded-t");
    			add_location(div4, file$2, 48, 6, 1435);
    			attr_dev(div5, "class", "w-full mb-4");
    			add_location(div5, file$2, 47, 4, 1403);
    			attr_dev(h20, "class", "w-full my-2 text-2xl font-bold leading-tight text-center");
    			add_location(h20, file$2, 51, 4, 1524);
    			attr_dev(img1, "alt", "Desktop Zen Garden with mini Torii Gate");
    			attr_dev(img1, "class", "max-w-sm mask mask-decagon");
    			if (!src_url_equal(img1.src, img1_src_value = "collections/zen/image-01.webp")) attr_dev(img1, "src", img1_src_value);
    			add_location(img1, file$2, 57, 8, 1744);
    			attr_dev(h30, "class", "mb-5 text-3xl font-bold");
    			add_location(h30, file$2, 63, 10, 1931);
    			attr_dev(p1, "class", "mb-5");
    			add_location(p1, file$2, 64, 10, 2002);
    			add_location(div6, file$2, 62, 8, 1915);
    			attr_dev(div7, "class", "flex-col hero-content lg:flex-row-reverse");
    			add_location(div7, file$2, 56, 6, 1680);
    			attr_dev(div8, "class", "hero");
    			add_location(div8, file$2, 55, 4, 1655);
    			attr_dev(img2, "alt", "Desktop Zen Garden with mini tree");
    			attr_dev(img2, "class", "max-w-sm mask mask-circle");
    			if (!src_url_equal(img2.src, img2_src_value = "collections/zen/image-02.webp")) attr_dev(img2, "src", img2_src_value);
    			add_location(img2, file$2, 76, 8, 2457);
    			attr_dev(h31, "class", "mb-5 text-3xl font-bold");
    			add_location(h31, file$2, 82, 10, 2637);
    			attr_dev(p2, "class", "mb-5");
    			add_location(p2, file$2, 83, 10, 2712);
    			add_location(div9, file$2, 81, 8, 2621);
    			attr_dev(div10, "class", "flex-col hero-content lg:flex-row");
    			add_location(div10, file$2, 75, 6, 2401);
    			attr_dev(div11, "class", "hero");
    			add_location(div11, file$2, 74, 4, 2376);
    			attr_dev(div12, "class", "h-1 mx-auto gradient w-64 opacity-25 my-0 py-0 rounded-t");
    			add_location(div12, file$2, 94, 6, 3078);
    			attr_dev(div13, "class", "w-full mb-4");
    			add_location(div13, file$2, 93, 4, 3046);
    			attr_dev(h21, "class", "w-full my-2 text-2xl font-bold leading-tight text-center");
    			add_location(h21, file$2, 97, 4, 3167);
    			attr_dev(a1, "class", "btn btn-primary");
    			attr_dev(a1, "href", "zen");
    			add_location(a1, file$2, 125, 8, 4093);
    			attr_dev(div14, "class", "flex md:w-1/2 lg:w-1/3 p-2");
    			add_location(div14, file$2, 124, 6, 4044);
    			attr_dev(div15, "class", "container mx-auto flex flex-wrap pt-4 pb-12");
    			add_location(div15, file$2, 101, 4, 3281);
    			attr_dev(div16, "class", "container max-w-5xl mx-auto m-8");
    			add_location(div16, file$2, 40, 2, 1168);
    			attr_dev(section0, "id", "zen");
    			attr_dev(section0, "class", "py-8");
    			add_location(section0, file$2, 39, 0, 1126);
    			attr_dev(div17, "class", "divider");
    			add_location(div17, file$2, 133, 0, 4218);
    			attr_dev(h12, "class", "w-full my-2 text-5xl font-bold leading-tight text-center");
    			add_location(h12, file$2, 139, 6, 4472);
    			attr_dev(a2, "href", "dad-jokes");
    			attr_dev(a2, "class", "w-full no-underline hover:no-underline");
    			add_location(a2, file$2, 138, 4, 4389);
    			attr_dev(div18, "class", "h-1 mx-auto gradient w-64 opacity-25 my-0 py-0 rounded-t");
    			add_location(div18, file$2, 144, 6, 4617);
    			attr_dev(div19, "class", "w-full mb-4");
    			add_location(div19, file$2, 143, 4, 4585);
    			attr_dev(h22, "class", "w-full my-2 text-2xl font-bold leading-tight text-center");
    			add_location(h22, file$2, 146, 4, 4705);
    			attr_dev(img3, "alt", "Father and son holding hands looking at a sunset");
    			attr_dev(img3, "class", "max-w-sm mask mask-hexagon-2");
    			if (!src_url_equal(img3.src, img3_src_value = "collections/dad-jokes/image-01.webp")) attr_dev(img3, "src", img3_src_value);
    			add_location(img3, file$2, 152, 8, 4920);
    			attr_dev(h32, "class", "mb-5 text-3xl font-bold");
    			add_location(h32, file$2, 158, 10, 5124);
    			attr_dev(p3, "class", "mb-5");
    			add_location(p3, file$2, 159, 10, 5196);
    			add_location(div20, file$2, 157, 8, 5108);
    			attr_dev(div21, "class", "flex-col hero-content lg:flex-row-reverse");
    			add_location(div21, file$2, 151, 6, 4856);
    			attr_dev(div22, "class", "hero");
    			add_location(div22, file$2, 150, 4, 4831);
    			attr_dev(img4, "alt", "My son, Malachi Marine");
    			attr_dev(img4, "class", "max-w-sm mask mask-heart");
    			if (!src_url_equal(img4.src, img4_src_value = "collections/dad-jokes/image-02.webp")) attr_dev(img4, "src", img4_src_value);
    			add_location(img4, file$2, 171, 8, 5625);
    			attr_dev(h33, "class", "mb-5 text-3xl font-bold");
    			add_location(h33, file$2, 177, 10, 5799);
    			attr_dev(p4, "class", "mb-5");
    			add_location(p4, file$2, 178, 10, 5868);
    			add_location(div23, file$2, 176, 8, 5783);
    			attr_dev(div24, "class", "flex-col hero-content lg:flex-row");
    			add_location(div24, file$2, 170, 6, 5569);
    			attr_dev(div25, "class", "hero");
    			add_location(div25, file$2, 169, 4, 5544);
    			attr_dev(div26, "class", "h-1 mx-auto gradient w-64 opacity-25 my-0 py-0 rounded-t");
    			add_location(div26, file$2, 188, 6, 6189);
    			attr_dev(div27, "class", "w-full mb-4");
    			add_location(div27, file$2, 187, 4, 6157);
    			attr_dev(h23, "class", "w-full my-2 text-2xl font-bold leading-tight text-center");
    			add_location(h23, file$2, 191, 4, 6278);
    			attr_dev(a3, "class", "btn btn-primary");
    			attr_dev(a3, "href", "dad-jokes");
    			add_location(a3, file$2, 221, 8, 7377);
    			attr_dev(div28, "class", "flex md:w-1/2 lg:w-1/3 p-2");
    			add_location(div28, file$2, 220, 6, 7328);
    			attr_dev(div29, "class", "container mx-auto flex flex-wrap pt-4 pb-12");
    			add_location(div29, file$2, 195, 4, 6407);
    			attr_dev(div30, "class", "container max-w-5xl mx-auto m-8");
    			add_location(div30, file$2, 137, 2, 4339);
    			attr_dev(section1, "id", "dad-jokes");
    			attr_dev(section1, "class", "py-8");
    			add_location(section1, file$2, 136, 0, 4291);
    			attr_dev(div31, "class", "divider");
    			add_location(div31, file$2, 229, 0, 7514);
    			attr_dev(h13, "class", "w-full my-2 text-5xl font-bold leading-tight text-center");
    			add_location(h13, file$2, 235, 6, 7753);
    			attr_dev(a4, "href", "blog");
    			attr_dev(a4, "class", "w-full no-underline hover:no-underline");
    			add_location(a4, file$2, 234, 4, 7675);
    			attr_dev(div32, "class", "h-1 mx-auto gradient w-64 opacity-25 my-0 py-0 rounded-t");
    			add_location(div32, file$2, 240, 6, 7893);
    			attr_dev(div33, "class", "w-full mb-4");
    			add_location(div33, file$2, 239, 4, 7861);
    			attr_dev(h24, "class", "w-full my-2 text-2xl font-bold leading-tight text-center");
    			add_location(h24, file$2, 242, 4, 7981);
    			attr_dev(a5, "class", "btn btn-primary");
    			attr_dev(a5, "href", "blog");
    			add_location(a5, file$2, 265, 8, 8931);
    			attr_dev(div34, "class", "flex md:w-1/2 lg:w-1/3 p-2");
    			add_location(div34, file$2, 264, 6, 8882);
    			attr_dev(div35, "class", "container mx-auto flex flex-wrap pt-4 pb-12");
    			add_location(div35, file$2, 246, 4, 8115);
    			attr_dev(div36, "class", "container max-w-5xl mx-auto m-8");
    			add_location(div36, file$2, 233, 2, 7625);
    			attr_dev(section2, "id", "blog");
    			attr_dev(section2, "class", "py-8");
    			add_location(section2, file$2, 232, 0, 7582);
    			attr_dev(div37, "class", "divider");
    			add_location(div37, file$2, 273, 0, 9061);
    			attr_dev(h14, "class", "w-full my-2 text-5xl font-bold leading-tight text-center");
    			add_location(h14, file$2, 279, 6, 9319);
    			attr_dev(a6, "href", "recipes");
    			attr_dev(a6, "class", "w-full no-underline hover:no-underline");
    			add_location(a6, file$2, 278, 4, 9238);
    			attr_dev(div38, "class", "h-1 mx-auto gradient w-64 opacity-25 my-0 py-0 rounded-t");
    			add_location(div38, file$2, 284, 6, 9462);
    			attr_dev(div39, "class", "w-full mb-4");
    			add_location(div39, file$2, 283, 4, 9430);
    			attr_dev(h25, "class", "w-full my-2 text-2xl font-bold leading-tight text-center");
    			add_location(h25, file$2, 286, 4, 9550);
    			attr_dev(a7, "class", "btn btn-primary");
    			attr_dev(a7, "href", "recipes");
    			add_location(a7, file$2, 309, 8, 10488);
    			attr_dev(div40, "class", "flex md:w-1/2 lg:w-1/3 p-2");
    			add_location(div40, file$2, 308, 6, 10439);
    			attr_dev(div41, "class", "container mx-auto flex flex-wrap pt-4 pb-12");
    			add_location(div41, file$2, 290, 4, 9661);
    			attr_dev(div42, "class", "container max-w-5xl mx-auto m-8");
    			add_location(div42, file$2, 277, 2, 9188);
    			attr_dev(section3, "id", "recipes");
    			attr_dev(section3, "class", "py-8");
    			add_location(section3, file$2, 276, 0, 9142);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, div2, anchor);
    			append_hydration_dev(div2, div1);
    			append_hydration_dev(div1, img0);
    			append_hydration_dev(div1, t0);
    			append_hydration_dev(div1, div0);
    			append_hydration_dev(div0, h10);
    			append_hydration_dev(h10, t1);
    			append_hydration_dev(div0, t2);
    			append_hydration_dev(div0, p0);
    			append_hydration_dev(p0, t3);
    			append_hydration_dev(div0, t4);
    			append_hydration_dev(div0, button);
    			append_hydration_dev(button, t5);
    			insert_hydration_dev(target, t6, anchor);
    			insert_hydration_dev(target, div3, anchor);
    			append_hydration_dev(div3, t7);
    			insert_hydration_dev(target, t8, anchor);
    			insert_hydration_dev(target, section0, anchor);
    			append_hydration_dev(section0, div16);
    			append_hydration_dev(div16, a0);
    			append_hydration_dev(a0, h11);
    			append_hydration_dev(h11, t9);
    			append_hydration_dev(div16, t10);
    			append_hydration_dev(div16, div5);
    			append_hydration_dev(div5, div4);
    			append_hydration_dev(div16, t11);
    			append_hydration_dev(div16, h20);
    			append_hydration_dev(h20, t12);
    			append_hydration_dev(div16, t13);
    			append_hydration_dev(div16, div8);
    			append_hydration_dev(div8, div7);
    			append_hydration_dev(div7, img1);
    			append_hydration_dev(div7, t14);
    			append_hydration_dev(div7, div6);
    			append_hydration_dev(div6, h30);
    			append_hydration_dev(h30, t15);
    			append_hydration_dev(div6, t16);
    			append_hydration_dev(div6, p1);
    			append_hydration_dev(p1, t17);
    			append_hydration_dev(div16, t18);
    			append_hydration_dev(div16, div11);
    			append_hydration_dev(div11, div10);
    			append_hydration_dev(div10, img2);
    			append_hydration_dev(div10, t19);
    			append_hydration_dev(div10, div9);
    			append_hydration_dev(div9, h31);
    			append_hydration_dev(h31, t20);
    			append_hydration_dev(div9, t21);
    			append_hydration_dev(div9, p2);
    			append_hydration_dev(p2, t22);
    			append_hydration_dev(div16, t23);
    			append_hydration_dev(div16, div13);
    			append_hydration_dev(div13, div12);
    			append_hydration_dev(div16, t24);
    			append_hydration_dev(div16, h21);
    			append_hydration_dev(h21, t25);
    			append_hydration_dev(div16, t26);
    			append_hydration_dev(div16, div15);

    			for (let i = 0; i < each_blocks_3.length; i += 1) {
    				each_blocks_3[i].m(div15, null);
    			}

    			append_hydration_dev(div15, t27);
    			append_hydration_dev(div15, div14);
    			append_hydration_dev(div14, a1);
    			append_hydration_dev(a1, t28);
    			insert_hydration_dev(target, t29, anchor);
    			insert_hydration_dev(target, div17, anchor);
    			append_hydration_dev(div17, t30);
    			insert_hydration_dev(target, t31, anchor);
    			insert_hydration_dev(target, section1, anchor);
    			append_hydration_dev(section1, div30);
    			append_hydration_dev(div30, a2);
    			append_hydration_dev(a2, h12);
    			append_hydration_dev(h12, t32);
    			append_hydration_dev(div30, t33);
    			append_hydration_dev(div30, div19);
    			append_hydration_dev(div19, div18);
    			append_hydration_dev(div30, t34);
    			append_hydration_dev(div30, h22);
    			append_hydration_dev(h22, t35);
    			append_hydration_dev(div30, t36);
    			append_hydration_dev(div30, div22);
    			append_hydration_dev(div22, div21);
    			append_hydration_dev(div21, img3);
    			append_hydration_dev(div21, t37);
    			append_hydration_dev(div21, div20);
    			append_hydration_dev(div20, h32);
    			append_hydration_dev(h32, t38);
    			append_hydration_dev(div20, t39);
    			append_hydration_dev(div20, p3);
    			append_hydration_dev(p3, t40);
    			append_hydration_dev(div30, t41);
    			append_hydration_dev(div30, div25);
    			append_hydration_dev(div25, div24);
    			append_hydration_dev(div24, img4);
    			append_hydration_dev(div24, t42);
    			append_hydration_dev(div24, div23);
    			append_hydration_dev(div23, h33);
    			append_hydration_dev(h33, t43);
    			append_hydration_dev(div23, t44);
    			append_hydration_dev(div23, p4);
    			append_hydration_dev(p4, t45);
    			append_hydration_dev(div30, t46);
    			append_hydration_dev(div30, div27);
    			append_hydration_dev(div27, div26);
    			append_hydration_dev(div30, t47);
    			append_hydration_dev(div30, h23);
    			append_hydration_dev(h23, t48);
    			append_hydration_dev(div30, t49);
    			append_hydration_dev(div30, div29);

    			for (let i = 0; i < each_blocks_2.length; i += 1) {
    				each_blocks_2[i].m(div29, null);
    			}

    			append_hydration_dev(div29, t50);
    			append_hydration_dev(div29, div28);
    			append_hydration_dev(div28, a3);
    			append_hydration_dev(a3, t51);
    			insert_hydration_dev(target, t52, anchor);
    			insert_hydration_dev(target, div31, anchor);
    			append_hydration_dev(div31, t53);
    			insert_hydration_dev(target, t54, anchor);
    			insert_hydration_dev(target, section2, anchor);
    			append_hydration_dev(section2, div36);
    			append_hydration_dev(div36, a4);
    			append_hydration_dev(a4, h13);
    			append_hydration_dev(h13, t55);
    			append_hydration_dev(div36, t56);
    			append_hydration_dev(div36, div33);
    			append_hydration_dev(div33, div32);
    			append_hydration_dev(div36, t57);
    			append_hydration_dev(div36, h24);
    			append_hydration_dev(h24, t58);
    			append_hydration_dev(div36, t59);
    			append_hydration_dev(div36, div35);

    			for (let i = 0; i < each_blocks_1.length; i += 1) {
    				each_blocks_1[i].m(div35, null);
    			}

    			append_hydration_dev(div35, t60);
    			append_hydration_dev(div35, div34);
    			append_hydration_dev(div34, a5);
    			append_hydration_dev(a5, t61);
    			insert_hydration_dev(target, t62, anchor);
    			insert_hydration_dev(target, div37, anchor);
    			append_hydration_dev(div37, t63);
    			insert_hydration_dev(target, t64, anchor);
    			insert_hydration_dev(target, section3, anchor);
    			append_hydration_dev(section3, div42);
    			append_hydration_dev(div42, a6);
    			append_hydration_dev(a6, h14);
    			append_hydration_dev(h14, t65);
    			append_hydration_dev(div42, t66);
    			append_hydration_dev(div42, div39);
    			append_hydration_dev(div39, div38);
    			append_hydration_dev(div42, t67);
    			append_hydration_dev(div42, h25);
    			append_hydration_dev(h25, t68);
    			append_hydration_dev(div42, t69);
    			append_hydration_dev(div42, div41);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div41, null);
    			}

    			append_hydration_dev(div41, t70);
    			append_hydration_dev(div41, div40);
    			append_hydration_dev(div40, a7);
    			append_hydration_dev(a7, t71);

    			if (!mounted) {
    				dispose = [
    					listen_dev(button, "click", /*click_handler*/ ctx[5], false, false, false),
    					action_destroyer(link.call(null, a0)),
    					action_destroyer(link.call(null, a1)),
    					action_destroyer(link.call(null, a2)),
    					action_destroyer(link.call(null, a3)),
    					action_destroyer(link.call(null, a4)),
    					action_destroyer(link.call(null, a5)),
    					action_destroyer(link.call(null, a6)),
    					action_destroyer(link.call(null, a7))
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*$zen*/ 1) {
    				each_value_3 = /*$zen*/ ctx[0].slice(0, 3);
    				validate_each_argument(each_value_3);
    				let i;

    				for (i = 0; i < each_value_3.length; i += 1) {
    					const child_ctx = get_each_context_3(ctx, each_value_3, i);

    					if (each_blocks_3[i]) {
    						each_blocks_3[i].p(child_ctx, dirty);
    					} else {
    						each_blocks_3[i] = create_each_block_3(child_ctx);
    						each_blocks_3[i].c();
    						each_blocks_3[i].m(div15, t27);
    					}
    				}

    				for (; i < each_blocks_3.length; i += 1) {
    					each_blocks_3[i].d(1);
    				}

    				each_blocks_3.length = each_value_3.length;
    			}

    			if (dirty & /*$dadJokes*/ 2) {
    				each_value_2 = /*$dadJokes*/ ctx[1].slice(0, 3);
    				validate_each_argument(each_value_2);
    				let i;

    				for (i = 0; i < each_value_2.length; i += 1) {
    					const child_ctx = get_each_context_2(ctx, each_value_2, i);

    					if (each_blocks_2[i]) {
    						each_blocks_2[i].p(child_ctx, dirty);
    					} else {
    						each_blocks_2[i] = create_each_block_2(child_ctx);
    						each_blocks_2[i].c();
    						each_blocks_2[i].m(div29, t50);
    					}
    				}

    				for (; i < each_blocks_2.length; i += 1) {
    					each_blocks_2[i].d(1);
    				}

    				each_blocks_2.length = each_value_2.length;
    			}

    			if (dirty & /*$blog*/ 4) {
    				each_value_1 = /*$blog*/ ctx[2].slice(0, 3);
    				validate_each_argument(each_value_1);
    				let i;

    				for (i = 0; i < each_value_1.length; i += 1) {
    					const child_ctx = get_each_context_1(ctx, each_value_1, i);

    					if (each_blocks_1[i]) {
    						each_blocks_1[i].p(child_ctx, dirty);
    					} else {
    						each_blocks_1[i] = create_each_block_1(child_ctx);
    						each_blocks_1[i].c();
    						each_blocks_1[i].m(div35, t60);
    					}
    				}

    				for (; i < each_blocks_1.length; i += 1) {
    					each_blocks_1[i].d(1);
    				}

    				each_blocks_1.length = each_value_1.length;
    			}

    			if (dirty & /*$recipes*/ 8) {
    				each_value = /*$recipes*/ ctx[3].slice(0, 3);
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(div41, t70);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}
    		},
    		i: function intro(local) {
    			if (!div2_intro) {
    				add_render_callback(() => {
    					div2_intro = create_in_transition(div2, fade, {});
    					div2_intro.start();
    				});
    			}

    			if (!section0_intro) {
    				add_render_callback(() => {
    					section0_intro = create_in_transition(section0, fade, {});
    					section0_intro.start();
    				});
    			}

    			if (!section1_intro) {
    				add_render_callback(() => {
    					section1_intro = create_in_transition(section1, fade, {});
    					section1_intro.start();
    				});
    			}

    			if (!section2_intro) {
    				add_render_callback(() => {
    					section2_intro = create_in_transition(section2, fade, {});
    					section2_intro.start();
    				});
    			}

    			if (!section3_intro) {
    				add_render_callback(() => {
    					section3_intro = create_in_transition(section3, fade, {});
    					section3_intro.start();
    				});
    			}
    		},
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div2);
    			if (detaching) detach_dev(t6);
    			if (detaching) detach_dev(div3);
    			if (detaching) detach_dev(t8);
    			if (detaching) detach_dev(section0);
    			destroy_each(each_blocks_3, detaching);
    			if (detaching) detach_dev(t29);
    			if (detaching) detach_dev(div17);
    			if (detaching) detach_dev(t31);
    			if (detaching) detach_dev(section1);
    			destroy_each(each_blocks_2, detaching);
    			if (detaching) detach_dev(t52);
    			if (detaching) detach_dev(div31);
    			if (detaching) detach_dev(t54);
    			if (detaching) detach_dev(section2);
    			destroy_each(each_blocks_1, detaching);
    			if (detaching) detach_dev(t62);
    			if (detaching) detach_dev(div37);
    			if (detaching) detach_dev(t64);
    			if (detaching) detach_dev(section3);
    			destroy_each(each_blocks, detaching);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot$1.name,
    		type: "slot",
    		source: "(14:0) <Content>",
    		ctx
    	});

    	return block;
    }

    function create_fragment$2(ctx) {
    	let content;
    	let current;

    	content = new Content({
    			props: {
    				$$slots: { default: [create_default_slot$1] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(content.$$.fragment);
    		},
    		l: function claim(nodes) {
    			claim_component(content.$$.fragment, nodes);
    		},
    		m: function mount(target, anchor) {
    			mount_component(content, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			const content_changes = {};

    			if (dirty & /*$$scope, $recipes, $blog, $dadJokes, $zen*/ 32783) {
    				content_changes.$$scope = { dirty, ctx };
    			}

    			content.$set(content_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(content.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(content.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(content, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$2.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$2($$self, $$props, $$invalidate) {
    	let $zen;
    	let $dadJokes;
    	let $blog;
    	let $recipes;
    	validate_store(zen, 'zen');
    	component_subscribe($$self, zen, $$value => $$invalidate(0, $zen = $$value));
    	validate_store(dadJokes, 'dadJokes');
    	component_subscribe($$self, dadJokes, $$value => $$invalidate(1, $dadJokes = $$value));
    	validate_store(blog, 'blog');
    	component_subscribe($$self, blog, $$value => $$invalidate(2, $blog = $$value));
    	validate_store(recipes, 'recipes');
    	component_subscribe($$self, recipes, $$value => $$invalidate(3, $recipes = $$value));
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Home', slots, []);
    	collection.set("");
    	document$1.set("");

    	const scrollTo = id => {
    		const element = window.document.getElementById(id);
    		element.scrollIntoView({ behavior: "smooth" });
    	};

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Home> was created with unknown prop '${key}'`);
    	});

    	const click_handler = () => {
    		scrollTo("zen");
    	};

    	$$self.$capture_state = () => ({
    		fade,
    		link,
    		Content,
    		zen,
    		dadJokes,
    		blog,
    		recipes,
    		collection,
    		document: document$1,
    		scrollTo,
    		$zen,
    		$dadJokes,
    		$blog,
    		$recipes
    	});

    	return [$zen, $dadJokes, $blog, $recipes, scrollTo, click_handler];
    }

    class Home extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$2, create_fragment$2, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Home",
    			options,
    			id: create_fragment$2.name
    		});
    	}
    }

    /* src/routes/NotFound.svelte generated by Svelte v3.44.1 */
    const file$1 = "src/routes/NotFound.svelte";

    function create_fragment$1(ctx) {
    	let div2;
    	let div1;
    	let div0;
    	let t0;
    	let h2;
    	let t1;
    	let h2_intro;
    	let div2_intro;

    	const block = {
    		c: function create() {
    			div2 = element("div");
    			div1 = element("div");
    			div0 = element("div");
    			t0 = space();
    			h2 = element("h2");
    			t1 = text("Well, this is embarrassing! We can't find the page you're looking for!");
    			this.h();
    		},
    		l: function claim(nodes) {
    			div2 = claim_element(nodes, "DIV", { class: true });
    			var div2_nodes = children(div2);
    			div1 = claim_element(div2_nodes, "DIV", { class: true });
    			var div1_nodes = children(div1);
    			div0 = claim_element(div1_nodes, "DIV", { class: true });
    			children(div0).forEach(detach_dev);
    			div1_nodes.forEach(detach_dev);
    			t0 = claim_space(div2_nodes);
    			h2 = claim_element(div2_nodes, "H2", { class: true });
    			var h2_nodes = children(h2);
    			t1 = claim_text(h2_nodes, "Well, this is embarrassing! We can't find the page you're looking for!");
    			h2_nodes.forEach(detach_dev);
    			div2_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(div0, "class", "h-1 mx-auto gradient w-64 opacity-25 my-0 py-0 rounded-t");
    			add_location(div0, file$1, 8, 4, 276);
    			attr_dev(div1, "class", "w-full mb-4");
    			add_location(div1, file$1, 7, 2, 246);
    			attr_dev(h2, "class", "w-full my-2 text-xl lg:text-2xl font-bold leading-tight text-center");
    			add_location(h2, file$1, 10, 2, 360);
    			attr_dev(div2, "class", "container mx-auto flex flex-wrap pt-4 pb-12");
    			add_location(div2, file$1, 6, 0, 178);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, div2, anchor);
    			append_hydration_dev(div2, div1);
    			append_hydration_dev(div1, div0);
    			append_hydration_dev(div2, t0);
    			append_hydration_dev(div2, h2);
    			append_hydration_dev(h2, t1);
    		},
    		p: noop,
    		i: function intro(local) {
    			if (!h2_intro) {
    				add_render_callback(() => {
    					h2_intro = create_in_transition(h2, fade, {});
    					h2_intro.start();
    				});
    			}

    			if (!div2_intro) {
    				add_render_callback(() => {
    					div2_intro = create_in_transition(div2, fade, {});
    					div2_intro.start();
    				});
    			}
    		},
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div2);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$1.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$1($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('NotFound', slots, []);
    	collection.set("Not Found");
    	document$1.set("");
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<NotFound> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({ fade, collection, document: document$1 });
    	return [];
    }

    class NotFound extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "NotFound",
    			options,
    			id: create_fragment$1.name
    		});
    	}
    }

    /* src/App.svelte generated by Svelte v3.44.1 */
    const file = "src/App.svelte";

    // (337431:2) <Route path="zen/:id" let:params>
    function create_default_slot_13(ctx) {
    	let zen;
    	let current;

    	zen = new Zen({
    			props: { id: /*params*/ ctx[1].id },
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(zen.$$.fragment);
    		},
    		l: function claim(nodes) {
    			claim_component(zen.$$.fragment, nodes);
    		},
    		m: function mount(target, anchor) {
    			mount_component(zen, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const zen_changes = {};
    			if (dirty & /*params*/ 2) zen_changes.id = /*params*/ ctx[1].id;
    			zen.$set(zen_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(zen.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(zen.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(zen, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot_13.name,
    		type: "slot",
    		source: "(337431:2) <Route path=\\\"zen/:id\\\" let:params>",
    		ctx
    	});

    	return block;
    }

    // (337434:2) <Route path="zen">
    function create_default_slot_12(ctx) {
    	let zen;
    	let current;
    	zen = new Zen({ props: { id: null }, $$inline: true });

    	const block = {
    		c: function create() {
    			create_component(zen.$$.fragment);
    		},
    		l: function claim(nodes) {
    			claim_component(zen.$$.fragment, nodes);
    		},
    		m: function mount(target, anchor) {
    			mount_component(zen, target, anchor);
    			current = true;
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;
    			transition_in(zen.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(zen.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(zen, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot_12.name,
    		type: "slot",
    		source: "(337434:2) <Route path=\\\"zen\\\">",
    		ctx
    	});

    	return block;
    }

    // (337438:2) <Route path="dad-jokes/:id" let:params>
    function create_default_slot_11(ctx) {
    	let dadjokes;
    	let current;

    	dadjokes = new DadJokes({
    			props: { id: /*params*/ ctx[1].id },
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(dadjokes.$$.fragment);
    		},
    		l: function claim(nodes) {
    			claim_component(dadjokes.$$.fragment, nodes);
    		},
    		m: function mount(target, anchor) {
    			mount_component(dadjokes, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const dadjokes_changes = {};
    			if (dirty & /*params*/ 2) dadjokes_changes.id = /*params*/ ctx[1].id;
    			dadjokes.$set(dadjokes_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(dadjokes.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(dadjokes.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(dadjokes, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot_11.name,
    		type: "slot",
    		source: "(337438:2) <Route path=\\\"dad-jokes/:id\\\" let:params>",
    		ctx
    	});

    	return block;
    }

    // (337441:2) <Route path="dad-jokes">
    function create_default_slot_10(ctx) {
    	let dadjokes;
    	let current;
    	dadjokes = new DadJokes({ props: { id: null }, $$inline: true });

    	const block = {
    		c: function create() {
    			create_component(dadjokes.$$.fragment);
    		},
    		l: function claim(nodes) {
    			claim_component(dadjokes.$$.fragment, nodes);
    		},
    		m: function mount(target, anchor) {
    			mount_component(dadjokes, target, anchor);
    			current = true;
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;
    			transition_in(dadjokes.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(dadjokes.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(dadjokes, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot_10.name,
    		type: "slot",
    		source: "(337441:2) <Route path=\\\"dad-jokes\\\">",
    		ctx
    	});

    	return block;
    }

    // (337445:2) <Route path="blog/:id" let:params>
    function create_default_slot_9(ctx) {
    	let blog;
    	let current;

    	blog = new Blog({
    			props: { id: /*params*/ ctx[1].id },
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(blog.$$.fragment);
    		},
    		l: function claim(nodes) {
    			claim_component(blog.$$.fragment, nodes);
    		},
    		m: function mount(target, anchor) {
    			mount_component(blog, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const blog_changes = {};
    			if (dirty & /*params*/ 2) blog_changes.id = /*params*/ ctx[1].id;
    			blog.$set(blog_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(blog.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(blog.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(blog, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot_9.name,
    		type: "slot",
    		source: "(337445:2) <Route path=\\\"blog/:id\\\" let:params>",
    		ctx
    	});

    	return block;
    }

    // (337448:2) <Route path="blog">
    function create_default_slot_8(ctx) {
    	let blog;
    	let current;
    	blog = new Blog({ props: { id: null }, $$inline: true });

    	const block = {
    		c: function create() {
    			create_component(blog.$$.fragment);
    		},
    		l: function claim(nodes) {
    			claim_component(blog.$$.fragment, nodes);
    		},
    		m: function mount(target, anchor) {
    			mount_component(blog, target, anchor);
    			current = true;
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;
    			transition_in(blog.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(blog.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(blog, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot_8.name,
    		type: "slot",
    		source: "(337448:2) <Route path=\\\"blog\\\">",
    		ctx
    	});

    	return block;
    }

    // (337451:2) <Route path="posts/:id" let:params>
    function create_default_slot_7(ctx) {
    	let blog;
    	let current;

    	blog = new Blog({
    			props: { id: /*params*/ ctx[1].id },
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(blog.$$.fragment);
    		},
    		l: function claim(nodes) {
    			claim_component(blog.$$.fragment, nodes);
    		},
    		m: function mount(target, anchor) {
    			mount_component(blog, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const blog_changes = {};
    			if (dirty & /*params*/ 2) blog_changes.id = /*params*/ ctx[1].id;
    			blog.$set(blog_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(blog.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(blog.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(blog, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot_7.name,
    		type: "slot",
    		source: "(337451:2) <Route path=\\\"posts/:id\\\" let:params>",
    		ctx
    	});

    	return block;
    }

    // (337454:2) <Route path="posts">
    function create_default_slot_6(ctx) {
    	let blog;
    	let current;
    	blog = new Blog({ props: { id: null }, $$inline: true });

    	const block = {
    		c: function create() {
    			create_component(blog.$$.fragment);
    		},
    		l: function claim(nodes) {
    			claim_component(blog.$$.fragment, nodes);
    		},
    		m: function mount(target, anchor) {
    			mount_component(blog, target, anchor);
    			current = true;
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;
    			transition_in(blog.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(blog.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(blog, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot_6.name,
    		type: "slot",
    		source: "(337454:2) <Route path=\\\"posts\\\">",
    		ctx
    	});

    	return block;
    }

    // (337458:2) <Route path="recipes/:id" let:params>
    function create_default_slot_5(ctx) {
    	let recipes;
    	let current;

    	recipes = new Recipes({
    			props: {
    				id: /*params*/ ctx[1].id,
    				tab: "overview"
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(recipes.$$.fragment);
    		},
    		l: function claim(nodes) {
    			claim_component(recipes.$$.fragment, nodes);
    		},
    		m: function mount(target, anchor) {
    			mount_component(recipes, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const recipes_changes = {};
    			if (dirty & /*params*/ 2) recipes_changes.id = /*params*/ ctx[1].id;
    			recipes.$set(recipes_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(recipes.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(recipes.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(recipes, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot_5.name,
    		type: "slot",
    		source: "(337458:2) <Route path=\\\"recipes/:id\\\" let:params>",
    		ctx
    	});

    	return block;
    }

    // (337461:2) <Route path="recipes/:id/:tab" let:params>
    function create_default_slot_4(ctx) {
    	let recipes;
    	let current;

    	recipes = new Recipes({
    			props: {
    				id: /*params*/ ctx[1].id,
    				tab: /*params*/ ctx[1].tab
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(recipes.$$.fragment);
    		},
    		l: function claim(nodes) {
    			claim_component(recipes.$$.fragment, nodes);
    		},
    		m: function mount(target, anchor) {
    			mount_component(recipes, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const recipes_changes = {};
    			if (dirty & /*params*/ 2) recipes_changes.id = /*params*/ ctx[1].id;
    			if (dirty & /*params*/ 2) recipes_changes.tab = /*params*/ ctx[1].tab;
    			recipes.$set(recipes_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(recipes.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(recipes.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(recipes, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot_4.name,
    		type: "slot",
    		source: "(337461:2) <Route path=\\\"recipes/:id/:tab\\\" let:params>",
    		ctx
    	});

    	return block;
    }

    // (337464:2) <Route path="recipes">
    function create_default_slot_3(ctx) {
    	let recipes;
    	let current;

    	recipes = new Recipes({
    			props: { id: null, tab: null },
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(recipes.$$.fragment);
    		},
    		l: function claim(nodes) {
    			claim_component(recipes.$$.fragment, nodes);
    		},
    		m: function mount(target, anchor) {
    			mount_component(recipes, target, anchor);
    			current = true;
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;
    			transition_in(recipes.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(recipes.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(recipes, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot_3.name,
    		type: "slot",
    		source: "(337464:2) <Route path=\\\"recipes\\\">",
    		ctx
    	});

    	return block;
    }

    // (337468:2) <Route path="/">
    function create_default_slot_2(ctx) {
    	let home;
    	let current;
    	home = new Home({ $$inline: true });

    	const block = {
    		c: function create() {
    			create_component(home.$$.fragment);
    		},
    		l: function claim(nodes) {
    			claim_component(home.$$.fragment, nodes);
    		},
    		m: function mount(target, anchor) {
    			mount_component(home, target, anchor);
    			current = true;
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(home.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(home.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(home, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot_2.name,
    		type: "slot",
    		source: "(337468:2) <Route path=\\\"/\\\">",
    		ctx
    	});

    	return block;
    }

    // (337472:2) <Route>
    function create_default_slot_1(ctx) {
    	let notfound;
    	let current;
    	notfound = new NotFound({ $$inline: true });

    	const block = {
    		c: function create() {
    			create_component(notfound.$$.fragment);
    		},
    		l: function claim(nodes) {
    			claim_component(notfound.$$.fragment, nodes);
    		},
    		m: function mount(target, anchor) {
    			mount_component(notfound, target, anchor);
    			current = true;
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(notfound.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(notfound.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(notfound, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot_1.name,
    		type: "slot",
    		source: "(337472:2) <Route>",
    		ctx
    	});

    	return block;
    }

    // (337429:1) <Router url="{url}">
    function create_default_slot(ctx) {
    	let route0;
    	let t0;
    	let route1;
    	let t1;
    	let route2;
    	let t2;
    	let route3;
    	let t3;
    	let route4;
    	let t4;
    	let route5;
    	let t5;
    	let route6;
    	let t6;
    	let route7;
    	let t7;
    	let route8;
    	let t8;
    	let route9;
    	let t9;
    	let route10;
    	let t10;
    	let route11;
    	let t11;
    	let route12;
    	let current;

    	route0 = new Route({
    			props: {
    				path: "zen/:id",
    				$$slots: {
    					default: [
    						create_default_slot_13,
    						({ params }) => ({ 1: params }),
    						({ params }) => params ? 2 : 0
    					]
    				},
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	route1 = new Route({
    			props: {
    				path: "zen",
    				$$slots: { default: [create_default_slot_12] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	route2 = new Route({
    			props: {
    				path: "dad-jokes/:id",
    				$$slots: {
    					default: [
    						create_default_slot_11,
    						({ params }) => ({ 1: params }),
    						({ params }) => params ? 2 : 0
    					]
    				},
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	route3 = new Route({
    			props: {
    				path: "dad-jokes",
    				$$slots: { default: [create_default_slot_10] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	route4 = new Route({
    			props: {
    				path: "blog/:id",
    				$$slots: {
    					default: [
    						create_default_slot_9,
    						({ params }) => ({ 1: params }),
    						({ params }) => params ? 2 : 0
    					]
    				},
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	route5 = new Route({
    			props: {
    				path: "blog",
    				$$slots: { default: [create_default_slot_8] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	route6 = new Route({
    			props: {
    				path: "posts/:id",
    				$$slots: {
    					default: [
    						create_default_slot_7,
    						({ params }) => ({ 1: params }),
    						({ params }) => params ? 2 : 0
    					]
    				},
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	route7 = new Route({
    			props: {
    				path: "posts",
    				$$slots: { default: [create_default_slot_6] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	route8 = new Route({
    			props: {
    				path: "recipes/:id",
    				$$slots: {
    					default: [
    						create_default_slot_5,
    						({ params }) => ({ 1: params }),
    						({ params }) => params ? 2 : 0
    					]
    				},
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	route9 = new Route({
    			props: {
    				path: "recipes/:id/:tab",
    				$$slots: {
    					default: [
    						create_default_slot_4,
    						({ params }) => ({ 1: params }),
    						({ params }) => params ? 2 : 0
    					]
    				},
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	route10 = new Route({
    			props: {
    				path: "recipes",
    				$$slots: { default: [create_default_slot_3] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	route11 = new Route({
    			props: {
    				path: "/",
    				$$slots: { default: [create_default_slot_2] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	route12 = new Route({
    			props: {
    				$$slots: { default: [create_default_slot_1] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(route0.$$.fragment);
    			t0 = space();
    			create_component(route1.$$.fragment);
    			t1 = space();
    			create_component(route2.$$.fragment);
    			t2 = space();
    			create_component(route3.$$.fragment);
    			t3 = space();
    			create_component(route4.$$.fragment);
    			t4 = space();
    			create_component(route5.$$.fragment);
    			t5 = space();
    			create_component(route6.$$.fragment);
    			t6 = space();
    			create_component(route7.$$.fragment);
    			t7 = space();
    			create_component(route8.$$.fragment);
    			t8 = space();
    			create_component(route9.$$.fragment);
    			t9 = space();
    			create_component(route10.$$.fragment);
    			t10 = space();
    			create_component(route11.$$.fragment);
    			t11 = space();
    			create_component(route12.$$.fragment);
    		},
    		l: function claim(nodes) {
    			claim_component(route0.$$.fragment, nodes);
    			t0 = claim_space(nodes);
    			claim_component(route1.$$.fragment, nodes);
    			t1 = claim_space(nodes);
    			claim_component(route2.$$.fragment, nodes);
    			t2 = claim_space(nodes);
    			claim_component(route3.$$.fragment, nodes);
    			t3 = claim_space(nodes);
    			claim_component(route4.$$.fragment, nodes);
    			t4 = claim_space(nodes);
    			claim_component(route5.$$.fragment, nodes);
    			t5 = claim_space(nodes);
    			claim_component(route6.$$.fragment, nodes);
    			t6 = claim_space(nodes);
    			claim_component(route7.$$.fragment, nodes);
    			t7 = claim_space(nodes);
    			claim_component(route8.$$.fragment, nodes);
    			t8 = claim_space(nodes);
    			claim_component(route9.$$.fragment, nodes);
    			t9 = claim_space(nodes);
    			claim_component(route10.$$.fragment, nodes);
    			t10 = claim_space(nodes);
    			claim_component(route11.$$.fragment, nodes);
    			t11 = claim_space(nodes);
    			claim_component(route12.$$.fragment, nodes);
    		},
    		m: function mount(target, anchor) {
    			mount_component(route0, target, anchor);
    			insert_hydration_dev(target, t0, anchor);
    			mount_component(route1, target, anchor);
    			insert_hydration_dev(target, t1, anchor);
    			mount_component(route2, target, anchor);
    			insert_hydration_dev(target, t2, anchor);
    			mount_component(route3, target, anchor);
    			insert_hydration_dev(target, t3, anchor);
    			mount_component(route4, target, anchor);
    			insert_hydration_dev(target, t4, anchor);
    			mount_component(route5, target, anchor);
    			insert_hydration_dev(target, t5, anchor);
    			mount_component(route6, target, anchor);
    			insert_hydration_dev(target, t6, anchor);
    			mount_component(route7, target, anchor);
    			insert_hydration_dev(target, t7, anchor);
    			mount_component(route8, target, anchor);
    			insert_hydration_dev(target, t8, anchor);
    			mount_component(route9, target, anchor);
    			insert_hydration_dev(target, t9, anchor);
    			mount_component(route10, target, anchor);
    			insert_hydration_dev(target, t10, anchor);
    			mount_component(route11, target, anchor);
    			insert_hydration_dev(target, t11, anchor);
    			mount_component(route12, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const route0_changes = {};

    			if (dirty & /*$$scope, params*/ 6) {
    				route0_changes.$$scope = { dirty, ctx };
    			}

    			route0.$set(route0_changes);
    			const route1_changes = {};

    			if (dirty & /*$$scope*/ 4) {
    				route1_changes.$$scope = { dirty, ctx };
    			}

    			route1.$set(route1_changes);
    			const route2_changes = {};

    			if (dirty & /*$$scope, params*/ 6) {
    				route2_changes.$$scope = { dirty, ctx };
    			}

    			route2.$set(route2_changes);
    			const route3_changes = {};

    			if (dirty & /*$$scope*/ 4) {
    				route3_changes.$$scope = { dirty, ctx };
    			}

    			route3.$set(route3_changes);
    			const route4_changes = {};

    			if (dirty & /*$$scope, params*/ 6) {
    				route4_changes.$$scope = { dirty, ctx };
    			}

    			route4.$set(route4_changes);
    			const route5_changes = {};

    			if (dirty & /*$$scope*/ 4) {
    				route5_changes.$$scope = { dirty, ctx };
    			}

    			route5.$set(route5_changes);
    			const route6_changes = {};

    			if (dirty & /*$$scope, params*/ 6) {
    				route6_changes.$$scope = { dirty, ctx };
    			}

    			route6.$set(route6_changes);
    			const route7_changes = {};

    			if (dirty & /*$$scope*/ 4) {
    				route7_changes.$$scope = { dirty, ctx };
    			}

    			route7.$set(route7_changes);
    			const route8_changes = {};

    			if (dirty & /*$$scope, params*/ 6) {
    				route8_changes.$$scope = { dirty, ctx };
    			}

    			route8.$set(route8_changes);
    			const route9_changes = {};

    			if (dirty & /*$$scope, params*/ 6) {
    				route9_changes.$$scope = { dirty, ctx };
    			}

    			route9.$set(route9_changes);
    			const route10_changes = {};

    			if (dirty & /*$$scope*/ 4) {
    				route10_changes.$$scope = { dirty, ctx };
    			}

    			route10.$set(route10_changes);
    			const route11_changes = {};

    			if (dirty & /*$$scope*/ 4) {
    				route11_changes.$$scope = { dirty, ctx };
    			}

    			route11.$set(route11_changes);
    			const route12_changes = {};

    			if (dirty & /*$$scope*/ 4) {
    				route12_changes.$$scope = { dirty, ctx };
    			}

    			route12.$set(route12_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(route0.$$.fragment, local);
    			transition_in(route1.$$.fragment, local);
    			transition_in(route2.$$.fragment, local);
    			transition_in(route3.$$.fragment, local);
    			transition_in(route4.$$.fragment, local);
    			transition_in(route5.$$.fragment, local);
    			transition_in(route6.$$.fragment, local);
    			transition_in(route7.$$.fragment, local);
    			transition_in(route8.$$.fragment, local);
    			transition_in(route9.$$.fragment, local);
    			transition_in(route10.$$.fragment, local);
    			transition_in(route11.$$.fragment, local);
    			transition_in(route12.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(route0.$$.fragment, local);
    			transition_out(route1.$$.fragment, local);
    			transition_out(route2.$$.fragment, local);
    			transition_out(route3.$$.fragment, local);
    			transition_out(route4.$$.fragment, local);
    			transition_out(route5.$$.fragment, local);
    			transition_out(route6.$$.fragment, local);
    			transition_out(route7.$$.fragment, local);
    			transition_out(route8.$$.fragment, local);
    			transition_out(route9.$$.fragment, local);
    			transition_out(route10.$$.fragment, local);
    			transition_out(route11.$$.fragment, local);
    			transition_out(route12.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(route0, detaching);
    			if (detaching) detach_dev(t0);
    			destroy_component(route1, detaching);
    			if (detaching) detach_dev(t1);
    			destroy_component(route2, detaching);
    			if (detaching) detach_dev(t2);
    			destroy_component(route3, detaching);
    			if (detaching) detach_dev(t3);
    			destroy_component(route4, detaching);
    			if (detaching) detach_dev(t4);
    			destroy_component(route5, detaching);
    			if (detaching) detach_dev(t5);
    			destroy_component(route6, detaching);
    			if (detaching) detach_dev(t6);
    			destroy_component(route7, detaching);
    			if (detaching) detach_dev(t7);
    			destroy_component(route8, detaching);
    			if (detaching) detach_dev(t8);
    			destroy_component(route9, detaching);
    			if (detaching) detach_dev(t9);
    			destroy_component(route10, detaching);
    			if (detaching) detach_dev(t10);
    			destroy_component(route11, detaching);
    			if (detaching) detach_dev(t11);
    			destroy_component(route12, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot.name,
    		type: "slot",
    		source: "(337429:1) <Router url=\\\"{url}\\\">",
    		ctx
    	});

    	return block;
    }

    function create_fragment(ctx) {
    	let ion_app;
    	let navbar;
    	let t;
    	let router;
    	let current;
    	navbar = new Navbar({ $$inline: true });

    	router = new Router({
    			props: {
    				url: /*url*/ ctx[0],
    				$$slots: { default: [create_default_slot] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			ion_app = element("ion-app");
    			create_component(navbar.$$.fragment);
    			t = space();
    			create_component(router.$$.fragment);
    			this.h();
    		},
    		l: function claim(nodes) {
    			ion_app = claim_element(nodes, "ION-APP", {});
    			var ion_app_nodes = children(ion_app);
    			claim_component(navbar.$$.fragment, ion_app_nodes);
    			t = claim_space(ion_app_nodes);
    			claim_component(router.$$.fragment, ion_app_nodes);
    			ion_app_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			add_location(ion_app, file, 337425, 0, 9035894);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, ion_app, anchor);
    			mount_component(navbar, ion_app, null);
    			append_hydration_dev(ion_app, t);
    			mount_component(router, ion_app, null);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			const router_changes = {};
    			if (dirty & /*url*/ 1) router_changes.url = /*url*/ ctx[0];

    			if (dirty & /*$$scope*/ 4) {
    				router_changes.$$scope = { dirty, ctx };
    			}

    			router.$set(router_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(navbar.$$.fragment, local);
    			transition_in(router.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(navbar.$$.fragment, local);
    			transition_out(router.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(ion_app);
    			destroy_component(navbar);
    			destroy_component(router);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('App', slots, []);
    	let { url = "" } = $$props;
    	const writable_props = ['url'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('url' in $$props) $$invalidate(0, url = $$props.url);
    	};

    	$$self.$capture_state = () => ({
    		Navbar,
    		Router,
    		Route,
    		Zen,
    		DadJokes,
    		Blog,
    		Recipes,
    		Home,
    		NotFound,
    		url
    	});

    	$$self.$inject_state = $$props => {
    		if ('url' in $$props) $$invalidate(0, url = $$props.url);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [url];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, { url: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment.name
    		});
    	}

    	get url() {
    		throw new Error("<App>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set url(value) {
    		throw new Error("<App>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    const app = new App({
        target: document.body,
        hydrate: true
    });

    return app;

})();
//# sourceMappingURL=bundle.js.map
