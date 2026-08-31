import json
import os
import re
from pathlib import Path

import requests
from seleniumbase import SB

URL = os.environ.get(
    "EVENT_LOCATOR_URL",
    "https://events.pokemon.com/EventLocator/?locale=en-GB&range=100&startdate=2026-08-31&iskm=false&latitude=51.4545&longitude=-2.5879",
)
OUT = Path("artifacts/event-locator-selenium-probe")
OUT.mkdir(parents=True, exist_ok=True)

with SB(uc=True, test=True, locale="en-GB", ad_block=True, xvfb=True) as sb:
    sb.activate_cdp_mode(URL)
    sb.sleep(5)
    sb.sleep(8)

    # Instrument requests before invoking the locator search. This records the
    # actual OutSystems request bodies rather than guessing their contract.
    try:
        sb.cdp.evaluate(r"""
          (() => {
            window.__ptcgNet = [];
            const safeBody = body => {
              try {
                if (body == null) return null;
                if (typeof body === 'string') return body;
                return JSON.stringify(body);
              } catch (_) { return String(body); }
            };
            const originalFetch = window.fetch;
            window.fetch = async function(input, init) {
              const url = typeof input === 'string' ? input : (input && input.url) || '';
              const method = (init && init.method) || (input && input.method) || 'GET';
              const rec = {kind:'fetch', url, method, requestBody:safeBody(init && init.body)};
              window.__ptcgNet.push(rec);
              const response = await originalFetch.apply(this, arguments);
              rec.status = response.status;
              try { rec.responseBody = (await response.clone().text()).slice(0, 100000); } catch (_) {}
              return response;
            };
            const originalOpen = XMLHttpRequest.prototype.open;
            const originalSend = XMLHttpRequest.prototype.send;
            XMLHttpRequest.prototype.open = function(method, url) {
              this.__ptcg = {kind:'xhr', method, url};
              return originalOpen.apply(this, arguments);
            };
            XMLHttpRequest.prototype.send = function(body) {
              const rec = this.__ptcg || {kind:'xhr'};
              rec.requestBody = safeBody(body);
              window.__ptcgNet.push(rec);
              this.addEventListener('loadend', () => {
                rec.status = this.status;
                try { rec.responseBody = String(this.responseText || '').slice(0, 100000); } catch (_) {}
              });
              return originalSend.apply(this, arguments);
            };
            return true;
          })()
        """)
    except Exception as exc:
        print(f"Request instrumentation failed: {exc}")

    # Search using the visible locator button. There are desktop/mobile copies,
    # so choose the visible element rather than relying on one generated ID.
    search_clicked = False
    try:
        search_clicked = bool(sb.cdp.evaluate(r"""
          (() => {
            const button = Array.from(document.querySelectorAll('button')).find(
              b => /search locations/i.test((b.innerText || b.textContent || '').trim()) && b.offsetParent !== null
            );
            if (!button) return false;
            button.click();
            return true;
          })()
        """))
    except Exception:
        pass
    if search_clicked:
        sb.sleep(15)

    title = sb.get_title() if hasattr(sb, "get_title") else ""
    source = sb.get_page_source()
    body_text = ""
    try:
        body_text = sb.cdp.get_text("body")
    except Exception:
        pass

    event_titles = []
    try:
        for node in sb.cdp.select_all("div.event-info__title"):
            text = (node.text or "").strip()
            if text:
                event_titles.append(text)
    except Exception:
        pass

    resources = []
    try:
        resources = sb.cdp.evaluate("performance.getEntriesByType('resource').map(x => x.name)") or []
    except Exception:
        pass

    captured_requests = []
    try:
        captured_requests = sb.cdp.evaluate("window.__ptcgNet || []") or []
    except Exception:
        pass

    candidate_html = []
    try:
        candidate_html = sb.cdp.evaluate("""
            Array.from(document.querySelectorAll('[class*=event],[class*=location]')).slice(0,250).map(el => ({
              tag: el.tagName,
              className: el.className || '',
              text: (el.innerText || el.textContent || '').trim().slice(0,1000),
              html: el.outerHTML.slice(0,3000)
            }))
        """) or []
    except Exception:
        pass

    (OUT / "page.html").write_text(source, encoding="utf-8")
    (OUT / "body.txt").write_text(body_text or "", encoding="utf-8")
    (OUT / "resources.json").write_text(json.dumps(resources, indent=2), encoding="utf-8")
    (OUT / "captured-requests.json").write_text(json.dumps(captured_requests, indent=2), encoding="utf-8")
    (OUT / "candidate-nodes.json").write_text(json.dumps(candidate_html, indent=2), encoding="utf-8")
    try:
        sb.save_screenshot(str(OUT / "page.png"))
    except Exception:
        pass

    static_probe = []
    service_refs = set()
    action_refs = set()
    js_resources = [u for u in resources if "/EventLocator/scripts/" in u and ".js" in u]
    for idx, resource_url in enumerate(js_resources):
        try:
            response = requests.get(resource_url, timeout=25, headers={
                "User-Agent": "Mozilla/5.0",
                "Accept": "*/*",
                "Referer": URL,
            })
            text = response.text
            filename = f"script-{idx:02d}.js"
            (OUT / filename).write_text(text, encoding="utf-8", errors="ignore")
            refs = re.findall(r"(?:/EventLocator/)?screenservices/[A-Za-z0-9_./-]+", text, flags=re.I)
            acts = re.findall(r"Action[A-Za-z0-9_]+", text)
            service_refs.update(refs)
            action_refs.update(acts)
            static_probe.append({
                "url": resource_url,
                "status": response.status_code,
                "contentType": response.headers.get("content-type", ""),
                "length": len(text),
                "serviceRefCount": len(refs),
            })
        except Exception as exc:
            static_probe.append({"url": resource_url, "error": str(exc)})

    (OUT / "static-script-probe.json").write_text(json.dumps(static_probe, indent=2), encoding="utf-8")
    (OUT / "service-refs.json").write_text(json.dumps(sorted(service_refs), indent=2), encoding="utf-8")
    (OUT / "action-refs.json").write_text(json.dumps(sorted(action_refs), indent=2), encoding="utf-8")

    search_requests = [r for r in captured_requests if "screenservices" in str(r.get("url", "")).lower()]
    print(json.dumps({
        "url": URL,
        "title": title,
        "searchClicked": search_clicked,
        "bodySample": (body_text or "")[:1200],
        "eventTitleCount": len(event_titles),
        "eventTitles": event_titles[:40],
        "candidateNodeCount": len(candidate_html),
        "resourceCount": len(resources),
        "capturedScreenServiceRequests": search_requests,
        "serviceRefs": sorted(service_refs)[:150],
        "actionRefsContainingEvent": [a for a in sorted(action_refs) if "event" in a.lower() or "location" in a.lower()][:150],
    }, indent=2))
