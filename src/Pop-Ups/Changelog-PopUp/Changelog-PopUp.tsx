import { createSignal, onMount, Show, For } from "solid-js";
import { render } from "solid-js/web";
import { Modal } from "../Modal/Modal";
import { Info, ExternalLink, AlertCircle, Tag, Calendar } from "lucide-solid";
import { ChangelogEntry } from "../../api/changelog/api";
import { toTitleCase } from "../../helpers/format";

interface ChangelogPopupProps {
    fetchChangelog: () => Promise<ChangelogEntry[]>;
    onClose?: () => void;
}


//comments are here for next release, i'll place everything in the api and make this better and cleaner
function transformChangelogHTML(html: string): string {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html || "", "text/html");
    const body = doc.body;

    // H1 
    body.querySelectorAll("h1").forEach((h1) => {
        h1.classList.add(
            "text-3xl",
            "font-extrabold",
            "text-accent",
            "mb-6",
            "mt-8",
            "pb-3",
            "border-b-2",
            "border-accent/20"
        );
    });

    // H2 
    body.querySelectorAll("h2").forEach((h2) => {
        const text = h2.textContent?.trim() || "";

        if (text.toLowerCase().includes("what's changed") ||
            text.toLowerCase().includes("whats changed")) {
            h2.classList.add(
                "text-lg",
                "font-semibold",
                "text-muted",
                "mb-4",
                "mt-6",
                "uppercase",
                "tracking-wide",
                "text-xs"
            );
        } else if (text.toLowerCase().includes("breaking")) {
            h2.classList.add(
                "text-xl",
                "font-bold",
                "text-red-400",
                "mb-4",
                "mt-6",
                "pb-2",
                "border-b",
                "border-red-500/30",
                "flex",
                "items-center",
                "gap-2"
            );
            h2.innerHTML = `
                <svg class="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                ${text}
            `;
        } else {
            h2.classList.add(
                "text-xl",
                "font-bold",
                "text-accent",
                "mb-4",
                "mt-6",
                "pb-2",
                "border-b",
                "border-accent/20"
            );
        }
    });

    // H3
    body.querySelectorAll("h3").forEach((h3) => {
        h3.classList.add(
            "text-base",
            "font-semibold",
            "text-text",
            "mb-3",
            "mt-5",
            "flex",
            "items-center",
            "gap-2"
        );
        const text = h3.textContent || "";
        h3.innerHTML = `
            <span class="w-1 h-4 bg-accent/60 rounded-full shrink-0"></span>
            ${text}
        `;
    });

    // H4-H6
    body.querySelectorAll("h4, h5, h6").forEach((h) => {
        h.classList.add(
            "text-sm",
            "font-semibold",
            "text-text/90",
            "mb-2",
            "mt-4"
        );
    });

    // Paragraphs 
    body.querySelectorAll("p").forEach((p) => {
        p.classList.add("text-text/80", "leading-relaxed", "mb-3");
    });

    // Lists
    body.querySelectorAll("ul").forEach((ul) => {
        ul.classList.add("space-y-2.5", "mb-4");
    });

    body.querySelectorAll("ol").forEach((ol) => {
        ol.classList.add("space-y-2.5", "mb-4", "list-decimal", "list-inside");
    });

    const liNodes = Array.from(body.querySelectorAll("li"));
    const typeRegex = /^(feat|fix|refactor|core|chore|docs|style|test|perf|ci|build)(?:\([^)]+\))?(!)?:/i;

    liNodes.forEach((li) => {
        li.classList.add("flex", "items-start", "gap-3", "text-sm", "leading-relaxed", "group/item");
        const fullText = li.textContent?.trim() ?? "";

        // Handle @mentions
        if (fullText.includes("@")) {
            let html = li.innerHTML;
            const usernameMatch = html.match(/@[a-zA-Z0-9_-]+/);
            if (usernameMatch) {
                const username = usernameMatch[0];
                const colors = [
                    "text-blue-400",
                    "text-purple-400",
                    "text-pink-400",
                    "text-green-400",
                    "text-yellow-400",
                    "text-cyan-400",
                    "text-orange-400",
                    "text-indigo-400",
                ];

                let hash = 0;
                for (let i = 0; i < username.length; i++) {
                    hash = username.charCodeAt(i) + (hash << 5) - hash;
                }
                const color = colors[Math.abs(hash) % colors.length];
                const highlightedUsername = `<span class="font-semibold ${color} hover:opacity-80 transition-opacity no-underline">${username}</span>`;
                html = html.replace(username, highlightedUsername);
            }

            const tempDiv = document.createElement("div");
            tempDiv.innerHTML = html;
            const links = Array.from(tempDiv.querySelectorAll("a"));
            links.forEach(a => {
                const wrapper = document.createElement("div");
                wrapper.appendChild(a.cloneNode(true));
                a.replaceWith(wrapper);
            });
            li.innerHTML = tempDiv.innerHTML;
        }

        const match = fullText.match(typeRegex);
        const originalInner = li.innerHTML;

        if (match) {
            const type = match[1].toLowerCase();
            const isBreaking = match[2] === "!";

            const scopeMatch = fullText.match(/\(([^)]+)\)/);
            const scope = scopeMatch ? scopeMatch[1] : null;

            let badgeColor = "bg-secondary-20 text-text";

            switch (type) {
                case "feat":
                    badgeColor = "bg-green-500/20 text-green-400 border border-green-500/30";
                    break;
                case "fix":
                    badgeColor = "bg-red-500/20 text-red-400 border border-red-500/30";
                    break;
                case "refactor":
                    badgeColor = "bg-blue-500/20 text-blue-400 border border-blue-500/30";
                    break;
                case "core":
                    badgeColor = "bg-purple-500/20 text-purple-400 border border-purple-500/30";
                    break;
                case "chore":
                    badgeColor = "bg-gray-500/20 text-gray-400 border border-gray-500/30";
                    break;
                case "docs":
                    badgeColor = "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30";
                    break;
                case "perf":
                    badgeColor = "bg-orange-500/20 text-orange-400 border border-orange-500/30";
                    break;
                case "style":
                    badgeColor = "bg-pink-500/20 text-pink-400 border border-pink-500/30";
                    break;
                case "test":
                    badgeColor = "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30";
                    break;
            }

            // Remove the full type token (including scope and breaking indicator) from innerHTML
            const innerWithoutToken = originalInner.replace(typeRegex, "").trim();

            let badgeHTML = `<span class="px-2 py-0.5 rounded text-xs font-semibold ${badgeColor} shrink-0 mt-0.5">${type}</span>`;

            if (scope) {
                badgeHTML += `<span class="px-1.5 py-0.5 rounded text-xs font-medium bg-background-60 text-muted border border-background-40 shrink-0 mt-0.5">${scope}</span>`;
            }

            if (isBreaking) {
                badgeHTML += `<span class="px-1.5 py-0.5 rounded text-xs font-bold bg-red-600/30 text-red-300 border border-red-500/50 shrink-0 mt-0.5">BREAKING</span>`;
            }

            li.innerHTML = `
                <div class="flex items-start gap-2 w-full">
                    <div class="flex items-center gap-1.5 shrink-0">
                        ${badgeHTML}
                    </div>
                    <span class="text-text/80 group-hover/item:text-text transition-colors flex-1">${innerWithoutToken}</span>
                </div>
            `;
        } else {
            li.innerHTML = `
                <div class="flex items-start gap-2 w-full">
                    <span class="w-1.5 h-1.5 rounded-full bg-accent/60 shrink-0 mt-2"></span>
                    <span class="text-text/80 group-hover/item:text-text transition-colors flex-1">${originalInner}</span>
                </div>
            `;
        }
    });

    // Links
    body.querySelectorAll("a").forEach((a) => {
        const text = a.textContent || "";
        if (text.includes("compare") || text.includes("...")) {
            a.classList.add(
                "inline-flex",
                "items-center",
                "gap-1.5",
                "text-accent",
                "hover:text-accent/80",
                "text-sm",
                "font-medium",
                "mt-2",
                "px-3",
                "py-1.5",
                "bg-accent/10",
                "rounded-lg",
                "border",
                "border-accent/20",
                "transition-all",
                "hover:bg-accent/15"
            );
            a.innerHTML = `
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                ${text}
            `;
        } else if (text.includes("#") || text.toLowerCase().includes("pull")) {
            a.classList.add(
                "text-accent/70",
                "hover:text-accent",
                "text-xs",
                "transition-colors",
                "no-underline",
                "font-mono",
                "bg-accent/10",
                "px-1.5",
                "py-0.5",
                "rounded"
            );
        } else {
            a.classList.add(
                "text-accent",
                "hover:text-accent/80",
                "underline",
                "decoration-accent/30",
                "hover:decoration-accent/60",
                "transition-colors",
                "underline-offset-2"
            );
        }
        a.setAttribute("target", "_blank");
        a.setAttribute("rel", "noopener noreferrer");
    });

    // Inline code
    body.querySelectorAll("code").forEach((code) => {
        if (!(code.parentElement?.tagName?.toLowerCase() === "pre")) {
            code.classList.add(
                "px-2",
                "py-0.5",
                "bg-secondary-20",
                "text-accent",
                "rounded",
                "text-xs",
                "font-mono",
                "border",
                "border-accent/10"
            );
        }
    });

    // Pre blocks
    body.querySelectorAll("pre").forEach((pre) => {
        pre.classList.add(
            "bg-secondary-20",
            "rounded-lg",
            "p-4",
            "overflow-x-auto",
            "text-sm",
            "mb-4",
            "border",
            "border-background-30",
            "shadow-inner"
        );
        const code = pre.querySelector("code");
        if (code) {
            code.classList.add("text-text", "font-mono", "text-xs");
        }
    });

    // Blockquotes
    body.querySelectorAll("blockquote").forEach((blockquote) => {
        blockquote.classList.add(
            "border-l-4",
            "border-accent/40",
            "pl-4",
            "pr-4",
            "py-3",
            "text-text/80",
            "italic",
            "mb-4",
            "bg-accent/5",
            "rounded-r-lg",
            "shadow-sm"
        );
    });

    // Strong/bold text
    body.querySelectorAll("strong").forEach((strong) => {
        strong.classList.add("font-semibold", "text-accent");
    });

    // Emphasis/italic text
    body.querySelectorAll("em").forEach((em) => {
        em.classList.add("italic", "text-text/90");
    });

    // Horizontal rules
    body.querySelectorAll("hr").forEach((hr) => {
        hr.classList.add(
            "my-6",
            "border-0",
            "h-px",
            "bg-gradient-to-r",
            "from-transparent",
            "via-background-30",
            "to-transparent"
        );
    });

    // Tables
    body.querySelectorAll("table").forEach((table) => {
        table.classList.add(
            "w-full",
            "border-collapse",
            "mb-4",
            "text-sm",
            "rounded-lg",
            "overflow-hidden"
        );
    });

    body.querySelectorAll("th").forEach((th) => {
        th.classList.add(
            "bg-accent/10",
            "text-accent",
            "font-semibold",
            "px-4",
            "py-2",
            "text-left",
            "border-b",
            "border-accent/20"
        );
    });

    body.querySelectorAll("td").forEach((td) => {
        td.classList.add(
            "px-4",
            "py-2",
            "border-b",
            "border-background-30",
            "text-text/80"
        );
    });

    body.querySelectorAll("tr").forEach((tr) => {
        tr.classList.add("hover:bg-secondary-10/30", "transition-colors");
    });

    return body.innerHTML;
}
const ChangelogPopup = (props: ChangelogPopupProps) => {
    const [changelog, setChangelog] = createSignal<ChangelogEntry[] | null>(null);
    const [loading, setLoading] = createSignal(true);
    const [error, setError] = createSignal<string | null>(null);

    onMount(async () => {
        try {
            const data = await props.fetchChangelog();
            // transform bodies before setting state
            const transformed = data.map((entry) => ({
                ...entry,
                body: transformChangelogHTML(entry.body || ""),
            }));
            setChangelog(transformed);
        } catch (e) {
            console.error("Failed to load changelog:", e);
            setError(e instanceof Error ? e.message : "Failed to load changelog");
            setChangelog([]);
        } finally {
            setLoading(false);
        }
    });

    return (
        <Modal infoTitle="Changelog" maxWidth="xl" onClose={props.onClose} confirmLabel="Close" onConfirm={props.onClose}>
            <div class="w-full max-w-3xl">
                <div class="max-h-[75vh] overflow-y-auto px-6 py-4 custom-scrollbar">

                    <Show
                        when={!loading()}
                        fallback={
                            <div class="flex flex-col items-center justify-center py-16">
                                <div class="relative w-20 h-20 mb-6">
                                    <div class="absolute inset-0 rounded-full bg-linear-to-tr from-accent/20 to-accent/5 border-2 border-accent/30 animate-pulse" />
                                    <div class="absolute inset-0 flex items-center justify-center">
                                        <Info class="w-10 h-10 text-accent animate-pulse" />
                                    </div>
                                </div>
                                <p class="text-lg text-muted animate-pulse">Loading changelog...</p>
                            </div>
                        }
                    >
                        {/* Error State */}
                        <Show when={error()}>
                            <div class="flex flex-col items-center justify-center py-16 text-center">
                                <div class="w-20 h-20 rounded-full bg-linear-to-br from-red-500/20 to-red-500/5 flex items-center justify-center mb-6 border-2 border-red-500/30">
                                    <AlertCircle class="w-10 h-10 text-red-500" />
                                </div>
                                <p class="text-red-500 font-semibold text-lg mb-2">Failed to load changelog</p>
                                <p class="text-muted text-sm max-w-md">{error()}</p>
                            </div>
                        </Show>

                        {/* Empty State */}
                        <Show when={!error() && (!changelog() || changelog()!.length === 0)}>
                            <div class="flex flex-col items-center justify-center py-16 text-center">
                                <div class="w-20 h-20 rounded-full bg-linear-to-br from-secondary-20 to-secondary-10 flex items-center justify-center mb-6 border-2 border-accent/20">
                                    <Info class="w-10 h-10 text-accent" />
                                </div>
                                <p class="text-lg text-muted">No changelog entries available.</p>
                            </div>
                        </Show>

                        {/* Changelog Content */}
                        <Show when={!error() && changelog() && changelog()!.length > 0}>
                            <For each={changelog()!}>
                                {(entry, index) => (
                                    <div class="flex flex-col bg-gradient-to-br from-secondary-10/50 to-transparent mb-6 ">
                                        {/* Version Header */}
                                        <div class="flex items-start h-full justify-between z-10 mb-3">
                                            <div class="flex h-full items-center gap-4">
                                                <div class="flex items-center gap-2 px-3 py-1.5 bg-accent/10 rounded-lg border border-accent/20">
                                                    <Tag class="w-4 h-4 text-accent" />
                                                    <h2 class="text-2xl font-bold text-accent">{toTitleCase(entry.version)}</h2>
                                                </div>

                                                <Show when={entry.url}>
                                                    <a
                                                        href={entry.url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        class="opacity-60 hover:opacity-100 transition-all hover:scale-110"
                                                        title="View on GitHub"
                                                    >
                                                        <ExternalLink class="w-5 h-5 text-accent" />
                                                    </a>
                                                </Show>
                                            </div>

                                            <div class="flex items-center h-full gap-2 px-3 justify-between bg-background-20/50 rounded-lg border border-background-30">
                                                <Calendar class="w-4 h-4 text-muted" />
                                                <span class="text-muted text-sm font-medium">{entry.date}</span>
                                            </div>
                                        </div>

                                        <div class="relative z-10 text-text" innerHTML={entry.body} />

                                        {/* Divider line for all but last entry */}
                                        <Show when={index() < changelog()!.length - 1}>
                                            <div class="mt-6 w-full h-px bg-linear-to-r from-transparent via-background-30 to-transparent" />
                                        </Show>
                                    </div>
                                )}
                            </For>
                        </Show>
                    </Show>
                </div>
            </div>
        </Modal>
    );
};


export function createChangelogPopup(props: ChangelogPopupProps) {
    const container = document.createElement("div");
    document.body.appendChild(container);

    const destroy = () => {
        render(() => null, container);
        container.remove();
        props.onClose?.();
    };

    render(() => <ChangelogPopup fetchChangelog={props.fetchChangelog} onClose={destroy} />, container);

    return destroy;
}

export default createChangelogPopup;
