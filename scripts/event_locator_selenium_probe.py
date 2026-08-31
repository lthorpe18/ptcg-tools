import json
import os
from pathlib import Path
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

    # Give the public locator time to complete its browser checks and render.
    sb.sleep(8)

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

    candidate_html = []
    try:
        candidate_html = sb.cdp.evaluate("""
            Array.from(document.querySelectorAll('[class*=event],[class*=location]')).slice(0,200).map(el => ({
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
    (OUT / "candidate-nodes.json").write_text(json.dumps(candidate_html, indent=2), encoding="utf-8")
    try:
        sb.save_screenshot(str(OUT / "page.png"))
    except Exception:
        pass

    interesting = [u for u in resources if any(k in u.lower() for k in ("api", "event", "location", "locator", "json"))]
    print(json.dumps({
        "url": URL,
        "title": title,
        "bodySample": (body_text or "")[:2000],
        "eventTitleCount": len(event_titles),
        "eventTitles": event_titles[:40],
        "candidateNodeCount": len(candidate_html),
        "resourceCount": len(resources),
        "interestingResources": interesting[:80],
    }, indent=2))
