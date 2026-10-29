(function script(css) {
	const running = window.__comarkZoom;
	if (running) {
		running.users++;
		return running.stop;
	}
	const listeners = new AbortController();
	const signal = listeners.signal;
	const style = document.querySelector("style[data-comark-zoom],link[data-comark-zoom]") ? null : document.createElement("style");
	if (style) {
		style.setAttribute("data-comark-zoom", "");
		style.textContent = css;
		document.head.append(style);
	}
	const SELECTOR = "[data-zoom]";
	const INTERACTIVE = "a,button,input,textarea,select,summary,label,video,audio";
	const motion = matchMedia("(prefers-reduced-motion: reduce)");
	const easing = "cubic-bezier(.22,1,.36,1)";
	let view = null;
	let restoration = null;
	let restoring = null;
	const el = (tag, className, attrs = {}) => {
		const node = document.createElement(tag);
		node.className = className;
		for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
		return node;
	};
	function outermost(node) {
		let item = node;
		for (let up = item.parentElement?.closest(SELECTOR); up; up = up.parentElement?.closest(SELECTOR)) item = up;
		return item;
	}
	function settle(root) {
		const nodes = [...root.querySelectorAll(`${SELECTOR}[tabindex="0"]`)];
		if (root.matches(`${SELECTOR}[tabindex="0"]`)) nodes.push(root);
		for (const node of nodes) if (node.parentElement?.closest(SELECTOR)) node.removeAttribute("tabindex");
	}
	function groupOf(item) {
		const group = item.getAttribute("data-zoom-group");
		const gallery = item.closest("[data-zoom-gallery]");
		const nodes = group ? document.querySelectorAll(`[data-zoom-group="${CSS.escape(group)}"]`) : gallery?.querySelectorAll(SELECTOR);
		if (!nodes) return [item];
		return [...nodes].filter((node) => {
			if (node === item) return true;
			const { width, height } = node.getBoundingClientRect();
			return outermost(node) === node && !node.closest(".cz-dialog") && (width > 0 || height > 0);
		});
	}
	function titleOf(item) {
		return item.getAttribute("data-zoom-title") || item.getAttribute("alt") || item.querySelector("img")?.getAttribute("alt") || (item.getAttribute("aria-roledescription") === "slide" ? "" : item.getAttribute("aria-label")) || "";
	}
	function strip(node) {
		for (const part of [node, ...node.querySelectorAll("*")]) for (const name of [
			"id",
			"data-zoom",
			"data-zoom-group",
			"data-zoom-context",
			"tabindex",
			"aria-haspopup"
		]) part.removeAttribute(name);
		node.style.visibility = "";
		node.style.margin = "0";
		return node;
	}
	const INHERITED = [
		"font-family",
		"font-size",
		"font-style",
		"font-weight",
		"letter-spacing",
		"text-align"
	];
	function lineHeight(parent, page) {
		const size = parseFloat(page.fontSize);
		if (page.lineHeight === "normal" || !size) return page.lineHeight;
		const probe = el("span", "");
		probe.style.cssText = `all:initial!important;position:absolute!important;visibility:hidden!important;font-size:${size * 2}px!important;line-height:inherit!important`;
		parent.append(probe);
		const scaled = getComputedStyle(probe).lineHeight !== page.lineHeight;
		probe.remove();
		return scaled ? String(parseFloat(page.lineHeight) / size) : page.lineHeight;
	}
	function contexts(item) {
		const selector = item.getAttribute("data-zoom-context");
		const found = [];
		if (selector) {
			for (let up = item.parentElement; up; up = up.parentElement) if (up.matches(selector)) found.unshift(up);
		}
		return found;
	}
	function copy(item, into, node = item) {
		const clone = strip(node.cloneNode(true));
		const around = contexts(item);
		const parent = (around[0] ?? item).parentElement;
		if (parent) {
			const page = getComputedStyle(parent);
			for (const name of INHERITED) into.style.setProperty(name, page.getPropertyValue(name));
			into.style.lineHeight = lineHeight(parent, page);
		}
		let inner = into;
		for (const context of around) {
			const shell = strip(context.cloneNode(false));
			shell.style.color = "inherit";
			inner.append(shell);
			inner = shell;
		}
		inner.append(clone);
		return clone;
	}
	function asideOf(item) {
		const selector = item.getAttribute("data-zoom-aside");
		const scope = contexts(item).at(-1) ?? item.parentElement;
		if (!selector || !scope) return null;
		return [...scope.querySelectorAll(selector)].find((node) => !item.contains(node) && !node.contains(item)) ?? null;
	}
	function across(pairs, node, from) {
		for (const pair of pairs) {
			const start = pair[from];
			if (!start.contains(node)) continue;
			const path = [];
			for (let at = node; at !== start && at.parentElement; at = at.parentElement) path.unshift([...at.parentElement.children].indexOf(at));
			let out = pair[from === 0 ? 1 : 0];
			for (const index of path) out = out?.children[index];
			return out ?? null;
		}
		return null;
	}
	function measure(item) {
		const rect = item.getBoundingClientRect();
		return {
			width: rect.width || 1,
			height: rect.height || 1,
			rect
		};
	}
	function detail(current) {
		return {
			dialog: current.dialog,
			header: current.header,
			footer: current.footer,
			layer: current.frame.querySelector(".cz-layer"),
			content: current.pairs[0][1],
			aside: current.aside.firstElementChild ? current.aside : null,
			item: current.items[current.index],
			index: current.index,
			items: current.items,
			copyOf: (node) => across(current.pairs, node, 0),
			originalOf: (node) => across(current.pairs, node, 1)
		};
	}
	function place(current) {
		const item = current.items[current.index];
		const { width } = measure(item);
		current.frame.style.width = `${width}px`;
		const height = current.frame.offsetHeight || 1;
		const box = current.stage.getBoundingClientRect();
		const next = current.stage.querySelector(".cz-next");
		const arrows = next ? 2 * (box.right - next.getBoundingClientRect().left + 8) : 0;
		const image = current.frame.firstElementChild;
		const large = image?.getAttribute("data-zoom-src");
		const natural = item instanceof HTMLImageElement && image instanceof HTMLImageElement && image.naturalWidth && (!large || image.getAttribute("src") === large) ? Math.max(1, image.naturalWidth / width) : 4;
		current.scale = Math.max(.1, Math.min(Math.min(box.width * .92, box.width - arrows) / width, box.height * .92 / height, natural, 4));
		current.frame.style.transform = `scale(${current.scale})`;
	}
	const showing = (current, image) => view === current && !current.closing && current.frame.contains(image);
	function enlarge(current, image) {
		const large = image.getAttribute("data-zoom-src");
		if (!large) return;
		const preload = new Image();
		preload.addEventListener("load", () => {
			if (!showing(current, image)) return;
			for (const source of image.closest("picture")?.querySelectorAll("source") ?? []) source.remove();
			image.removeAttribute("srcset");
			image.removeAttribute("sizes");
			image.src = large;
		});
		preload.src = large;
	}
	function travel(current, item) {
		const center = (node) => {
			const rect = node.getBoundingClientRect();
			return [rect.left + rect.width / 2, rect.top + rect.height / 2];
		};
		const [fx, fy] = center(current.frame);
		const [cx, cy] = center(current.frame.firstElementChild);
		const [tx, ty] = center(item);
		return `translate(${tx - fx - (cx - fx) / current.scale}px, ${ty - fy - (cy - fy) / current.scale}px)`;
	}
	function render(current) {
		const item = current.items[current.index];
		current.frame.replaceChildren();
		current.pairs = [[item, copy(item, current.frame)]];
		current.frame.append(el("div", "cz-layer"));
		const aside = asideOf(item);
		current.aside.replaceChildren();
		current.dialog.toggleAttribute("data-aside", Boolean(aside));
		if (aside) current.pairs.push([aside, copy(item, current.aside, aside)]);
		for (const image of current.frame.querySelectorAll("img")) {
			image.loading = "eager";
			image.addEventListener("load", () => showing(current, image) && place(current));
			enlarge(current, image);
		}
		current.title.textContent = titleOf(item);
		current.count.textContent = current.items.length > 1 ? `${current.index + 1} / ${current.items.length}` : "";
		current.dialog.setAttribute("aria-label", titleOf(item) || "Zoomed view");
		for (const [index, thumb] of [...current.footer.querySelectorAll(".cz-thumb")].entries()) thumb.setAttribute("aria-current", String(index === current.index));
		place(current);
	}
	function thumbs(current) {
		if (current.items.length < 2) return;
		const strip = el("div", "cz-strip", {
			role: "group",
			"aria-label": "Items"
		});
		current.footer.append(strip);
		for (const [index, item] of current.items.entries()) {
			const thumb = el("button", "cz-thumb", {
				type: "button",
				"aria-label": titleOf(item) || `Item ${index + 1}`
			});
			strip.append(thumb);
			const { width, height } = measure(item);
			const inner = el("div", "");
			inner.style.width = `${width}px`;
			inner.style.transform = `scale(${Math.min(thumb.clientWidth / width, thumb.clientHeight / height)})`;
			copy(item, inner);
			thumb.append(inner);
			thumb.addEventListener("click", () => go(index));
		}
	}
	function go(index) {
		if (!view || view.closing) return;
		view.items[view.index].style.visibility = "";
		view.index = (index + view.items.length) % view.items.length;
		view.items[view.index].style.visibility = "hidden";
		render(view);
		view.items[view.index].dispatchEvent(new CustomEvent("comark-zoom:change", {
			bubbles: true,
			detail: detail(view)
		}));
	}
	const root = document.documentElement;
	let unlocked = null;
	function lock() {
		scrollTo({
			left: scrollX,
			top: scrollY,
			behavior: "instant"
		});
		const scrollbar = innerWidth - root.clientWidth;
		unlocked = {
			overflow: root.style.overflow,
			gutter: root.style.scrollbarGutter,
			padding: root.style.paddingRight
		};
		if (scrollbar > 0) root.style.paddingRight = `${parseFloat(getComputedStyle(root).paddingRight) + scrollbar}px`;
		root.style.overflow = "hidden";
	}
	function unlock() {
		if (!unlocked) return;
		root.style.overflow = unlocked.overflow;
		root.style.scrollbarGutter = unlocked.gutter;
		root.style.paddingRight = unlocked.padding;
		unlocked = null;
	}
	function restore(later = false) {
		const saved = restoration;
		restoration = null;
		if (!saved) return;
		const put = () => {
			history.scrollRestoration = saved;
			restoring = null;
		};
		if (!later) return put();
		restoring = put;
		setTimeout(() => restoring === put && put());
	}
	function open(item) {
		if (view) return;
		const items = groupOf(item);
		const dialog = el("div", "cz-dialog", {
			role: "dialog",
			"aria-modal": "true",
			tabindex: "-1"
		});
		const header = el("div", "cz-header");
		const title = el("span", "cz-title");
		const count = el("span", "cz-count");
		const close = el("button", "cz-close", {
			type: "button",
			"aria-label": "Close"
		});
		close.textContent = "✕";
		header.append(title, count, close);
		const stage = el("div", "cz-stage");
		const frame = el("div", "cz-item");
		stage.append(frame);
		const aside = el("div", "cz-aside");
		const footer = el("div", "cz-footer");
		const backdrop = el("div", "cz-backdrop");
		dialog.append(backdrop, header, stage, aside, footer);
		const current = {
			dialog,
			header,
			title,
			count,
			stage,
			aside,
			footer,
			frame,
			pairs: [],
			items,
			index: Math.max(0, items.indexOf(item)),
			scale: 1,
			returnFocus: document.activeElement,
			pushed: false,
			closing: false,
			pressed: null
		};
		if (items.length > 1) for (const [name, step, label] of [[
			"cz-prev",
			-1,
			"Previous"
		], [
			"cz-next",
			1,
			"Next"
		]]) {
			const button = el("button", `cz-nav ${name}`, {
				type: "button",
				"aria-label": label
			});
			button.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${step < 0 ? "m15 18-6-6 6-6" : "m9 18 6-6-6-6"}"/></svg>`;
			button.addEventListener("click", () => go(current.index + step));
			stage.append(button);
		}
		view = current;
		document.body.append(dialog);
		thumbs(current);
		lock();
		render(current);
		close.addEventListener("click", () => void shut());
		dialog.addEventListener("pointerdown", (event) => current.pressed = event.target);
		dialog.addEventListener("click", (event) => {
			if ((event.target === stage || event.target === backdrop) && current.pressed === event.target) shut();
		});
		dialog.focus({ preventScroll: true });
		try {
			restoring?.();
			restoration = history.scrollRestoration;
			history.scrollRestoration = "manual";
			history.pushState({
				...history.state,
				comarkZoom: true
			}, "");
			current.pushed = true;
		} catch {
			if (restoration) history.scrollRestoration = restoration;
			restoration = null;
		}
		const shown = items[current.index];
		if (!motion.matches) {
			frame.animate([{ transform: `${travel(current, shown)} scale(1)` }, { transform: `scale(${current.scale})` }], {
				duration: 260,
				easing
			});
			for (const part of [
				backdrop,
				header,
				aside,
				footer
			]) part.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200 });
		}
		shown.style.visibility = "hidden";
		shown.dispatchEvent(new CustomEvent("comark-zoom:open", {
			bubbles: true,
			detail: detail(current)
		}));
	}
	async function shut(from = "page") {
		const current = view;
		if (!current || current.closing) return;
		current.closing = true;
		if (from === "page" && current.pushed && history.state?.comarkZoom) history.back();
		else if (from !== "history") restore();
		const item = current.items[current.index];
		if (!motion.matches) {
			const now = getComputedStyle(current.frame).transform;
			for (const animation of current.frame.getAnimations()) animation.cancel();
			const to = item.getBoundingClientRect();
			const visible = to.bottom > 0 && to.top < innerHeight;
			const animations = [...current.dialog.querySelectorAll(".cz-backdrop,.cz-header,.cz-aside,.cz-footer,.cz-nav")].map((part) => part.animate([{ opacity: 1 }, { opacity: 0 }], {
				duration: 180,
				fill: "forwards"
			}));
			animations.push(current.frame.animate(visible ? [{ transform: now }, { transform: `${travel(current, item)} scale(1)` }] : [{ opacity: 1 }, { opacity: 0 }], {
				duration: 200,
				easing,
				fill: "forwards"
			}));
			await Promise.all(animations.map((animation) => animation.finished.catch(() => {})));
		}
		for (const node of current.items) node.style.visibility = "";
		current.dialog.remove();
		unlock();
		view = null;
		if (current.returnFocus instanceof HTMLElement) current.returnFocus.focus({ preventScroll: true });
		item.dispatchEvent(new CustomEvent("comark-zoom:close", {
			bubbles: true,
			detail: { item }
		}));
	}
	document.addEventListener("click", (event) => {
		const target = event.target instanceof Element ? event.target : null;
		const found = target?.closest(SELECTOR);
		const item = found && outermost(found);
		if (!item || item.closest(".cz-dialog") || event.defaultPrevented) return;
		const control = target?.closest(INTERACTIVE);
		if (control && control !== item && item.contains(control)) return;
		if (!getSelection()?.isCollapsed) return;
		event.preventDefault();
		open(item);
	}, { signal });
	document.addEventListener("keydown", (event) => {
		if (!view) {
			const item = event.target instanceof HTMLElement && event.target.matches(SELECTOR) ? outermost(event.target) : null;
			if (item && (event.key === "Enter" || event.key === " ")) {
				event.preventDefault();
				open(item);
			}
			return;
		}
		if (event.key === "Escape") {
			event.preventDefault();
			shut();
		} else if (event.key === "ArrowLeft" && view.items.length > 1) go(view.index - 1);
		else if (event.key === "ArrowRight" && view.items.length > 1) go(view.index + 1);
		else if (event.key === "Tab") {
			const focusable = [...view.dialog.querySelectorAll("button,[href],[tabindex]:not([tabindex='-1'])")];
			if (!focusable.length) return;
			const first = focusable[0];
			const last = focusable[focusable.length - 1];
			if (event.shiftKey && (document.activeElement === first || document.activeElement === view.dialog)) {
				event.preventDefault();
				last.focus();
			} else if (!event.shiftKey && document.activeElement === last) {
				event.preventDefault();
				first.focus();
			}
		}
	}, { signal });
	addEventListener("popstate", () => {
		restore(true);
		shut("history");
	}, { signal });
	addEventListener("resize", () => view && place(view), { signal });
	settle(document.documentElement);
	const added = new MutationObserver((records) => {
		for (const record of records) for (const node of record.addedNodes) if (node instanceof Element) settle(node);
	});
	added.observe(document.documentElement, {
		childList: true,
		subtree: true
	});
	const state = {
		users: 1,
		stop: () => {
			if (--state.users > 0) return;
			added.disconnect();
			listeners.abort();
			style?.remove();
			shut("stop");
			window.__comarkZoom = void 0;
		}
	};
	window.__comarkZoom = state;
	return state.stop;
})("");
(function start() {
	const running = window.__comarkAnnotate;
	if (running) {
		running.users++;
		return running.stop;
	}
	const listeners = new AbortController();
	const signal = listeners.signal;
	const root = document.documentElement;
	root.setAttribute("data-annotate-ready", "");
	const motion = matchMedia("(prefers-reduced-motion: reduce)");
	const SLOP = 4;
	let drag = null;
	const dragged = /* @__PURE__ */ new WeakMap();
	const splits = /* @__PURE__ */ new WeakMap();
	const coasting = /* @__PURE__ */ new WeakMap();
	const swipeOf = (target) => target instanceof Element ? target.closest(".ca-swipe") : null;
	const splitOf = (swipe) => splits.get(swipe) ?? Number(swipe.querySelector(".ca-handle")?.getAttribute("aria-valuenow") ?? 50);
	const at = (swipe, x) => {
		const box = swipe.getBoundingClientRect();
		return (x - box.left) / (box.width || 1) * 100;
	};
	function set(swipe, value) {
		const split = Math.min(100, Math.max(0, value));
		splits.set(swipe, split);
		swipe.style.setProperty("--ca-split", `${split}%`);
		const handle = swipe.querySelector(".ca-handle");
		if (!handle) return split;
		const shown = Math.round(split);
		handle.setAttribute("aria-valuenow", String(shown));
		const labels = [...swipe.querySelectorAll(".ca-side .ca-label")].map((label) => label.textContent);
		if (labels.length === 2) handle.setAttribute("aria-valuetext", `${labels[0]} ${shown}%, ${labels[1]} ${100 - shown}%`);
		return split;
	}
	function stop(swipe) {
		cancelAnimationFrame(coasting.get(swipe) ?? 0);
		coasting.delete(swipe);
	}
	function coast(swipe, velocity) {
		if (motion.matches || Math.abs(velocity) < .02) return;
		let v = Math.max(-.2, Math.min(velocity, .2));
		let last = performance.now();
		const step = (now) => {
			const dt = Math.min(now - last, 32);
			last = now;
			const after = set(swipe, splitOf(swipe) + v * dt);
			v *= .85 ** (dt / 16);
			if (Math.abs(v) < .005 || after === 0 || after === 100) return stop(swipe);
			coasting.set(swipe, requestAnimationFrame(step));
		};
		coasting.set(swipe, requestAnimationFrame(step));
	}
	document.addEventListener("pointerdown", (event) => {
		const swipe = swipeOf(event.target);
		if (!swipe || !event.isPrimary || event.button !== 0) return;
		if (event.target instanceof Element && event.target.closest("a")) return;
		stop(swipe);
		drag = {
			swipe,
			id: event.pointerId,
			x: event.clientX,
			moved: false,
			t: event.timeStamp,
			v: 0
		};
	}, { signal });
	document.addEventListener("pointermove", (event) => {
		if (!drag || event.pointerId !== drag.id) return;
		if (!drag.moved) {
			if (Math.abs(event.clientX - drag.x) < SLOP) return;
			drag.moved = true;
			drag.swipe.setPointerCapture(drag.id);
			drag.swipe.setAttribute("data-dragging", "");
		}
		const before = splitOf(drag.swipe);
		const after = set(drag.swipe, at(drag.swipe, event.clientX));
		const dt = event.timeStamp - drag.t;
		if (dt > 0) drag.v = .8 * ((after - before) / dt) + .2 * drag.v;
		drag.t = event.timeStamp;
	}, { signal });
	const release = (event) => {
		if (!drag || event.pointerId !== drag.id) return;
		const { swipe, moved, v, t } = drag;
		drag = null;
		dragged.set(swipe, moved && event.type === "pointerup");
		if (!moved) return;
		swipe.removeAttribute("data-dragging");
		if (event.type === "pointerup" && event.timeStamp - t < 80) coast(swipe, v);
	};
	document.addEventListener("pointerup", release, { signal });
	document.addEventListener("pointercancel", release, { signal });
	addEventListener("click", (event) => {
		const swipe = swipeOf(event.target);
		if (!swipe) return;
		if (!(event.target instanceof Element && event.target.closest(".ca-handle")) && !dragged.get(swipe)) return;
		dragged.delete(swipe);
		event.preventDefault();
	}, {
		capture: true,
		signal
	});
	document.addEventListener("dragstart", (event) => {
		if (swipeOf(event.target)) event.preventDefault();
	}, { signal });
	const KEYS = /* @__PURE__ */ new Map([
		["ArrowLeft", (split) => split - 5],
		["ArrowDown", (split) => split - 5],
		["ArrowRight", (split) => split + 5],
		["ArrowUp", (split) => split + 5],
		["PageDown", (split) => split - 25],
		["PageUp", (split) => split + 25],
		["Home", () => 0],
		["End", () => 100]
	]);
	document.addEventListener("keydown", (event) => {
		const move = KEYS.get(event.key);
		const handle = event.target instanceof Element ? event.target.closest(".ca-handle") : null;
		const swipe = swipeOf(handle);
		if (!move || !swipe) return;
		event.preventDefault();
		stop(swipe);
		set(swipe, move(splitOf(swipe)));
	}, { signal });
	const focusable = () => {
		for (const handle of document.querySelectorAll(".cz-dialog .ca-handle")) handle.setAttribute("tabindex", "0");
	};
	document.addEventListener("comark-zoom:open", focusable, { signal });
	document.addEventListener("comark-zoom:change", focusable, { signal });
	const copying = "clipboard" in navigator && "ClipboardItem" in window;
	if (copying) root.setAttribute("data-annotate-copy", "");
	const PAD = 16;
	const SKIP = ".ca-copy,.ca-copy-status,.ca-overlay";
	const made = /* @__PURE__ */ new WeakMap();
	const making = /* @__PURE__ */ new WeakMap();
	const urls = /* @__PURE__ */ new Set();
	let zoomed = null;
	const figureOf = (target) => {
		if (!(target instanceof Element)) return null;
		if (target.closest(".cz-dialog")) return zoomed && target.closest(zoomed.matches(".ca-side") || zoomed.matches(".ca-swipe") ? ".ca-swipe" : ".ca-screenshot") ? zoomed : null;
		return target.closest(".ca-screenshot");
	};
	const keyOf = (figure) => {
		const { width, height } = figure.getBoundingClientRect();
		return `${Math.round(width)}x${Math.round(height)} ${getComputedStyle(figure).color}`;
	};
	const probe = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
	const shown = /* @__PURE__ */ new Map();
	const visible = (color) => {
		if (!probe || color === "transparent") return false;
		let seen = shown.get(color);
		if (seen === void 0) {
			probe.clearRect(0, 0, 1, 1);
			probe.fillStyle = color;
			probe.fillRect(0, 0, 1, 1);
			seen = probe.getImageData(0, 0, 1, 1).data[3] > 0;
			shown.set(color, seen);
		}
		return seen;
	};
	const round = (context, [x, y, width, height], radius) => {
		context.beginPath();
		const r = Math.max(0, Math.min(radius, width / 2, height / 2));
		if (!r) {
			context.rect(x, y, width, height);
			return;
		}
		context.moveTo(x + r, y);
		context.arcTo(x + width, y, x + width, y + height, r);
		context.arcTo(x + width, y + height, x, y + height, r);
		context.arcTo(x, y + height, x, y, r);
		context.arcTo(x, y, x + width, y, r);
		context.closePath();
	};
	async function compose(figure) {
		const image = figure.querySelector(".ca-frame>img:not(.ca-overlay)");
		if (!image) throw new Error("The screenshot has no image.");
		image.loading = "eager";
		if (!image.complete || !image.naturalWidth) await image.decode();
		await document.fonts.ready;
		const paint = [];
		figure.setAttribute("data-ca-capture", "still");
		const box = figure.getBoundingClientRect();
		const [left, top] = [box.left - PAD, box.top - PAD];
		const place = (rect) => [
			rect.left - left,
			rect.top - top,
			rect.width,
			rect.height
		];
		const fade = (element) => {
			let alpha = 1;
			for (let at = element; at && figure.contains(at); at = at.parentElement) alpha *= Number(getComputedStyle(at).opacity) || 0;
			return alpha;
		};
		try {
			const walker = document.createTreeWalker(figure, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, (node) => node instanceof Element && (node.matches(SKIP) || node instanceof SVGElement && !(node instanceof SVGSVGElement)) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT);
			for (let node = walker.nextNode(); node; node = walker.nextNode()) if (node instanceof Text && node.parentElement) {
				const style = getComputedStyle(node.parentElement);
				const font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
				const { color, letterSpacing } = style;
				const alpha = fade(node.parentElement);
				const range = document.createRange();
				for (const match of node.data.matchAll(/\S+/g)) {
					range.setStart(node, match.index);
					range.setEnd(node, match.index + match[0].length);
					const rect = range.getClientRects()[0];
					if (!rect?.width) continue;
					const [x, y, , height] = place(rect);
					paint.push((context) => {
						context.font = font;
						context.letterSpacing = letterSpacing === "normal" ? "0px" : letterSpacing;
						context.fillStyle = color;
						context.globalAlpha = alpha;
						const metrics = context.measureText(match[0]);
						const ascent = Number.isFinite(metrics.fontBoundingBoxAscent) && metrics.fontBoundingBoxAscent > 0 ? metrics.fontBoundingBoxAscent : Number.isFinite(metrics.actualBoundingBoxAscent) && metrics.actualBoundingBoxAscent > 0 ? metrics.actualBoundingBoxAscent : parseFloat(style.fontSize) || height * .8;
						const descent = Number.isFinite(metrics.fontBoundingBoxDescent) && metrics.fontBoundingBoxDescent >= 0 ? metrics.fontBoundingBoxDescent : Number.isFinite(metrics.actualBoundingBoxDescent) && metrics.actualBoundingBoxDescent >= 0 ? metrics.actualBoundingBoxDescent : Math.max(0, (parseFloat(style.fontSize) || height) - ascent);
						context.fillText(match[0], x, y + (height - ascent - descent) / 2 + ascent);
					});
				}
			} else if (node === image) {
				const style = getComputedStyle(image);
				const rect = place(image.getBoundingClientRect());
				const radius = parseFloat(style.borderTopLeftRadius) || 0;
				const outline = style.outlineStyle === "none" ? 0 : parseFloat(style.outlineWidth) || 0;
				const inset = -(parseFloat(style.outlineOffset) || 0) - outline / 2;
				const { outlineColor } = style;
				paint.push((context, source) => {
					context.save();
					round(context, rect, radius);
					context.clip();
					context.drawImage(source, ...rect);
					context.restore();
					if (!outline) return;
					const [x, y, width, height] = rect;
					round(context, [
						x + inset,
						y + inset,
						width - 2 * inset,
						height - 2 * inset
					], radius - inset);
					context.strokeStyle = outlineColor;
					context.lineWidth = outline;
					context.stroke();
				});
			} else if (node instanceof SVGSVGElement) {
				const view = node.viewBox.baseVal;
				const rect = node.getBoundingClientRect();
				if (!view?.width || !view.height || !rect.width || !rect.height) continue;
				const [x, y, width, height] = place(rect);
				const alpha = fade(node);
				const paths = [...node.querySelectorAll("path")].map((path) => {
					const style = getComputedStyle(path);
					const copy = path.cloneNode(false);
					copy.setAttribute("fill", style.fill);
					copy.setAttribute("stroke", style.stroke);
					copy.setAttribute("stroke-width", style.strokeWidth);
					copy.setAttribute("stroke-linecap", style.strokeLinecap);
					copy.setAttribute("stroke-linejoin", style.strokeLinejoin);
					copy.setAttribute("stroke-opacity", style.strokeOpacity);
					copy.setAttribute("fill-opacity", style.fillOpacity);
					copy.setAttribute("vector-effect", style.vectorEffect);
					return copy.outerHTML;
				});
				if (!paths.length) continue;
				const aspect = node.getAttribute("preserveAspectRatio") || "xMidYMid meet";
				let [x1, y1, x2, y2] = [
					view.x,
					view.y,
					view.x + view.width,
					view.y + view.height
				];
				if (aspect === "none") {
					const [padX, padY] = [6 * view.width / rect.width, 6 * view.height / rect.height];
					for (const path of node.querySelectorAll("path")) {
						const bounds = path.getBBox();
						x1 = Math.min(x1, bounds.x - padX);
						y1 = Math.min(y1, bounds.y - padY);
						x2 = Math.max(x2, bounds.x + bounds.width + padX);
						y2 = Math.max(y2, bounds.y + bounds.height + padY);
					}
				}
				const [scaleX, scaleY] = [width / view.width, height / view.height];
				const source = new Image();
				source.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x1} ${y1} ${x2 - x1} ${y2 - y1}" preserveAspectRatio="${aspect}">${paths.join("")}</svg>`)}`;
				await source.decode();
				paint.push((context) => {
					context.globalAlpha = alpha;
					context.drawImage(source, x + (x1 - view.x) * scaleX, y + (y1 - view.y) * scaleY, (x2 - x1) * scaleX, (y2 - y1) * scaleY);
				});
			} else if (node instanceof HTMLElement) {
				const style = getComputedStyle(node);
				const fill = visible(style.backgroundColor) ? style.backgroundColor : "";
				const ring = /(\S+\([^)]*\)|#\w+|[a-z]+) 0px 0px 0px ([\d.]+)px/i.exec(style.boxShadow);
				const border = style.borderTopStyle === "none" || !visible(style.borderTopColor) ? 0 : parseFloat(style.borderTopWidth) || 0;
				if (!fill && !(ring && visible(ring[1])) && !border) continue;
				const radius = parseFloat(style.borderTopLeftRadius) || 0;
				const { borderTopColor } = style;
				const alpha = fade(node);
				for (const rect of node.getClientRects()) {
					const [x, y, width, height] = place(rect);
					paint.push((context) => {
						context.globalAlpha = alpha;
						if (ring) {
							const spread = Number(ring[2]);
							context.fillStyle = ring[1];
							round(context, [
								x - spread,
								y - spread,
								width + 2 * spread,
								height + 2 * spread
							], radius + spread);
							context.fill();
						}
						if (fill) {
							context.fillStyle = fill;
							round(context, [
								x,
								y,
								width,
								height
							], radius);
							context.fill();
						}
						if (!border) return;
						context.strokeStyle = borderTopColor;
						context.lineWidth = border;
						round(context, [
							x + border / 2,
							y + border / 2,
							width - border,
							height - border
						], radius);
						context.stroke();
					});
				}
			}
		} finally {
			figure.setAttribute("data-ca-capture", "settle");
			figure.offsetWidth;
			figure.removeAttribute("data-ca-capture");
		}
		const width = box.width + 32;
		const height = box.height + 32;
		const shot = image.getBoundingClientRect();
		const scale = Math.min(3, Math.max(devicePixelRatio || 1, image.naturalWidth / (shot.width || 1)), 8192 / width, 8192 / height);
		const background = getComputedStyle(figure).getPropertyValue("--_comark-background").trim() || "#fff";
		const render = (source) => new Promise((resolve, reject) => {
			const canvas = document.createElement("canvas");
			canvas.width = Math.round(width * scale);
			canvas.height = Math.round(height * scale);
			const context = canvas.getContext("2d");
			if (!context) return reject(/* @__PURE__ */ new Error("No canvas."));
			context.scale(scale, scale);
			context.fillStyle = background;
			context.fillRect(0, 0, width, height);
			for (const step of paint) {
				context.save();
				step(context, source);
				context.restore();
			}
			canvas.toBlob((blob) => blob ? resolve(blob) : reject(/* @__PURE__ */ new Error("No image.")), "image/png");
		});
		try {
			return await render(image);
		} catch (error) {
			if (!(error instanceof DOMException) || error.name !== "SecurityError") throw error;
			const open = new Image();
			open.crossOrigin = "anonymous";
			open.src = image.currentSrc || image.src;
			await open.decode().catch(() => {
				throw error;
			});
			return render(open);
		}
	}
	function prepare(figure) {
		const key = keyOf(figure);
		const ready = made.get(figure);
		if (ready?.key === key) return Promise.resolve(ready);
		const pending = making.get(figure);
		if (pending) return pending;
		const next = compose(figure).then((blob) => {
			const url = URL.createObjectURL(blob);
			urls.add(url);
			const old = made.get(figure);
			if (old) {
				URL.revokeObjectURL(old.url);
				urls.delete(old.url);
			}
			const fresh = {
				key,
				blob,
				url
			};
			made.set(figure, fresh);
			overlayOf(figure.querySelector(".ca-frame")).src = url;
			return fresh;
		}).finally(() => making.delete(figure));
		making.set(figure, next);
		return next;
	}
	function overlayOf(frame) {
		let overlay = frame?.querySelector(":scope>.ca-overlay");
		if (!overlay) {
			overlay = document.createElement("img");
			overlay.className = "ca-overlay";
			overlay.alt = "";
			overlay.draggable = false;
			frame?.append(overlay);
		}
		return overlay;
	}
	let armed = null;
	let disarming = 0;
	const disarm = () => {
		clearTimeout(disarming);
		armed?.removeAttribute("data-menu");
		armed = null;
	};
	document.addEventListener("pointerover", (event) => {
		if (event.pointerType !== "mouse") return;
		const figure = figureOf(event.target);
		if (figure) prepare(figure).catch(() => {});
	}, { signal });
	document.addEventListener("pointerdown", (event) => {
		disarm();
		if (event.button !== 2 && !(event.button === 0 && event.ctrlKey)) return;
		const target = event.target instanceof Element ? event.target : null;
		const frame = target?.closest(".ca-frame");
		const figure = figureOf(frame ?? null);
		const ready = figure && made.get(figure);
		if (!frame || !ready || target?.closest(SKIP)) return;
		if (ready.key !== keyOf(figure)) prepare(figure).catch(() => {});
		armed = overlayOf(frame);
		if (armed.getAttribute("src") !== ready.url) armed.src = ready.url;
		armed.setAttribute("data-menu", "");
		disarming = window.setTimeout(disarm, 1500);
	}, {
		capture: true,
		signal
	});
	document.addEventListener("contextmenu", () => setTimeout(disarm), { signal });
	const say = (frame, message, state) => {
		const button = frame?.querySelector(".ca-copy");
		const status = frame?.querySelector(".ca-copy-status");
		if (!button || !status) return;
		button.setAttribute("data-state", state);
		status.textContent = message;
		setTimeout(() => {
			if (status.textContent !== message) return;
			button.removeAttribute("data-state");
			status.textContent = "";
		}, state === "done" ? 1500 : 6e3);
	};
	function copy(figure, frame) {
		let failed;
		const blob = prepare(figure).then((ready) => ready.blob, (error) => {
			failed = error;
			throw error;
		});
		navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]).then(() => say(frame, "Copied", "done"), (error) => {
			const reason = failed ?? error;
			const name = reason instanceof DOMException ? reason.name : "";
			say(frame, failed && name === "SecurityError" ? "The image's server doesn't allow copying it (no CORS)." : name === "NotAllowedError" || name === "SecurityError" ? "This page can't write to the clipboard. Right-click the image and copy it instead." : "Couldn't copy the screenshot.", "failed");
		});
	}
	document.addEventListener("click", (event) => {
		const button = event.target instanceof Element ? event.target.closest(".ca-copy") : null;
		const figure = figureOf(button);
		if (!button || !figure || !copying) return;
		event.preventDefault();
		copy(figure, button.closest(".ca-frame"));
	}, { signal });
	document.addEventListener("keydown", (event) => {
		if (event.key.toLowerCase() !== "c" || !(event.ctrlKey || event.metaKey)) return;
		if (event.altKey || event.shiftKey || !copying || !getSelection()?.isCollapsed) return;
		const target = event.target instanceof HTMLElement ? event.target : null;
		const own = target?.matches(".ca-screenshot") && !target.closest(".cz-dialog");
		const figure = own ? target : target?.matches(".cz-dialog") ? figureOf(target.querySelector(".ca-screenshot, .ca-swipe")) : null;
		if (!target || !figure) return;
		event.preventDefault();
		copy(figure, (own ? figure : target).querySelector(".ca-frame"));
	}, { signal });
	const follow = (event) => {
		const { item } = event.detail ?? {};
		zoomed = item instanceof HTMLElement ? item.closest(".ca-screenshot") ?? (item.matches(".ca-swipe") ? item.querySelector(".ca-side-before .ca-stage") : null) : null;
		for (const part of document.querySelectorAll(".cz-thumb :is(.ca-copy,.ca-copy-status)")) part.remove();
		for (const button of document.querySelectorAll(".cz-dialog .ca-copy[data-state]")) button.removeAttribute("data-state");
		for (const status of document.querySelectorAll(".cz-dialog .ca-copy-status")) status.textContent = "";
	};
	document.addEventListener("comark-zoom:open", follow, { signal });
	document.addEventListener("comark-zoom:change", follow, { signal });
	document.addEventListener("comark-zoom:close", () => zoomed = null, { signal });
	const state = {
		users: 1,
		stop: () => {
			if (--state.users > 0) return;
			listeners.abort();
			disarm();
			for (const url of urls) URL.revokeObjectURL(url);
			for (const overlay of document.querySelectorAll(".ca-overlay")) overlay.remove();
			root.removeAttribute("data-annotate-copy");
			root.removeAttribute("data-annotate-ready");
			window.__comarkAnnotate = void 0;
		}
	};
	window.__comarkAnnotate = state;
	return state.stop;
})()