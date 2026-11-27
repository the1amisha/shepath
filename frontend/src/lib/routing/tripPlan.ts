export function whatsappPlanUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

export function openPrintablePlan(text: string, chart?: HTMLElement | null): boolean {
  const win = window.open("", "_blank");
  if (!win) return false;
  win.opener = null;
  const doc = win.document;
  doc.title = "ShePath trip plan";
  doc.documentElement.lang = "en";
  const viewport = doc.createElement("meta");
  viewport.name = "viewport";
  viewport.content = "width=device-width, initial-scale=1";
  const style = doc.createElement("style");
  style.textContent =
    "*{box-sizing:border-box}body{font:16px/1.5 system-ui,sans-serif;color:#173f3b;max-width:760px;margin:24px auto;padding:0 20px}h1{font-size:24px;line-height:1.2}pre{font:inherit;white-space:pre-wrap;overflow-wrap:anywhere;min-width:0}button{font:inherit;padding:12px 20px;min-height:44px;cursor:pointer}@media print{button{display:none}body{font-size:10pt;line-height:1.35;margin:0;padding:0;max-width:none;color:#000}h1{font-size:16pt;margin:0 0 10pt}pre{margin:0;orphans:3;widows:3}@page{margin:14mm}}";
  doc.head.append(viewport, style);
  const button = doc.createElement("button");
  button.textContent = "Print / save as PDF";
  button.onclick = () => win.print();
  const heading = doc.createElement("h1");
  heading.textContent = "ShePath trip plan";
  const content = doc.createElement("pre");
  content.textContent = text;
  doc.body.replaceChildren(button, heading, content);
  if (chart) doc.body.append(doc.importNode(chart, true));
  return true;
}
