"""Build the "AI engineer for organisations" landing pages (design C).

Usage, from the repository root:
    python3 _tools/engineer-pages/build_engineer.py
Writes he/ai-engineer/index.html (primary, Hebrew, RTL) and ai-engineer/index.html (English).
The quick nav, footer and cookie dialog are copied from the AI adoption pages so the shell stays in step.
"""
import html, json, os, re

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
BASE = "https://www.mlaia.com"
WA = "https://wa.me/972524846282"

CSS = """
/* AI engineer page, design C: page-only pieces (shared system in /assets/mlaia-c.css) */
.e-intro{max-width:40em}
.c-hero__row p.e-audience{font:600 var(--c-fs-small)/1.5 var(--c-body);color:var(--c-fg);margin:0 0 14px}
.e-cta{background:var(--c-bg-2)}
.c-cell .c-links{margin-top:auto;padding-top:14px}
.e-table-wrap{border-top:1px solid var(--c-rule)}
.e-table{width:100%;border-collapse:collapse;font-size:var(--c-fs-small);line-height:1.5}
.e-table caption{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
.e-table th,.e-table td{padding:18px 20px;text-align:start;vertical-align:top;border-bottom:1px solid var(--c-rule)}
.e-table thead th{font:500 12px/1.2 var(--c-mono);letter-spacing:.06em;text-transform:uppercase;color:var(--c-muted)}
.e-table tbody th{width:22%;font:600 16px/1.35 var(--c-display);color:var(--c-fg)}
.e-table td{color:var(--c-text)}
.e-table .e-us{background:var(--c-bg-2);color:var(--c-fg)}
.e-table thead .e-us{color:var(--c-blue);border-top:3px solid var(--c-blue)}
.e-note{margin:18px 0 0;font-size:var(--c-fs-small);color:var(--c-muted)}
.e-steps{grid-template-columns:repeat(4,minmax(0,1fr))}
.e-steps .c-step__num{font-size:60px}
.e-steps .c-step h3{font-size:21px}
@media (max-width:1100px){
  .e-steps{grid-template-columns:1fr}
  .e-steps .c-step,.e-steps .c-step+.c-step{display:grid;grid-template-columns:64px minmax(0,1fr);column-gap:20px;padding:24px 0!important;border-left:0!important;border-right:0!important;border-bottom:1px solid var(--c-rule)}
  .e-steps .c-step__num{grid-row:span 2;margin:0;font-size:52px}
}
@media (max-width:640px){
  .e-table thead{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
  .e-table,.e-table tbody,.e-table tr,.e-table th,.e-table td{display:block;width:auto}
  .e-table tr{padding:16px 0;border-bottom:1px solid var(--c-rule)}
  .e-table tbody th{width:auto;padding:0 0 10px;border:0}
  .e-table td{padding:10px 14px;border:0}
  .e-table td::before{content:attr(data-label);display:block;margin-bottom:4px;font:500 11px/1.2 var(--c-mono);letter-spacing:.06em;text-transform:uppercase;color:var(--c-muted)}
  .e-table td.e-us::before{color:var(--c-blue)}
  .e-steps .c-step,.e-steps .c-step+.c-step{grid-template-columns:48px minmax(0,1fr);column-gap:14px}
  .e-steps .c-step__num{font-size:40px}
}
"""

T = {
 "he": dict(
  path="/he/ai-engineer/", alt="/ai-engineer/", adoption="/he/ai-adoption/", predict="/he/predictive-intelligence/",
  ultrabot="https://ultrabot.ai/he/knowledge-assistant/", home="/?lang=he",
  title="מהנדס AI לארגון: אסטרטגיה ופיתוח עד ייצור, בלי חצי שנה של גיוס | MLAIA",
  desc="מהנדס AI של MLAIA משתלב בארגון שלכם, עם צוות מדעני AI מאחוריו: מיפוי מקרי שימוש, פיילוט שמגיע לייצור, RAG וסוכנים על המערכות שלכם, חיזוי, מדיניות שימוש לפי תיקון 13 והדרכת עובדים.",
  service="מהנדס AI לארגון", og="ai-engineer-he.png", locale="he_IL",
  kicker="מהנדס AI לארגון",
  h1='מהנדס AI לארגון שלכם, <span class="c-accent">בלי חצי שנה של גיוס.</span>',
  audience="למנהלים, לסמנכ״לי מערכות מידע ולמובילי חדשנות בארגונים שמחפשים איש AI.",
  lead="מהנדס AI של MLAIA משתלב אצלכם בארגון, עם צוות של מדעני AI מאחוריו. הוא בוחר יחד איתכם מה שווה לבנות, ובונה את זה עד לייצור: עוזרים וסוכנים על המערכות שלכם, מודלים לחיזוי, מדיניות שימוש והדרכה לעובדים.",
  cta1='לתיאום שיחה של 20 דקות <span aria-hidden="true">↖</span>', cta2="לדבר בווטסאפ",
  specs_title="התפקיד, כשירות",
  specs=[("התפקיד","אסטרטגיה ופיתוח אצל אותו מהנדס, עם צוות מאחוריו"),("ההתחלה","מיפוי ופיילוט אחד בחודש הראשון"),("ההיקף","מספר ימים קבוע בשבוע, אצלכם או מרחוק")],
  pain_k="נשמע מוכר?", pain_h="המשרה פתוחה, וה-AI מחכה.",
  pains=[("המשרה פתוחה כבר חודשים","פרסמתם משרה ל-AI Lead, ל-AI Enablement או לארכיטקט AI, והמועמד המתאים עוד לא נמצא."),
         ("צריך מישהו אסטרטגי וגם מעשי","מי שמחליט מה שווה לבנות ומי שיודע לבנות את זה עד הסוף הם בדרך כלל שני אנשים שונים."),
         ("פיילוט שלא הגיע לייצור","ההדגמה עבדה, ואז נתקעה בהרשאות, בחיבור למערכות ובשאלה מי מתחזק אותה."),
         ("עובדים ב-ChatGPT בלי מדיניות","הכלים כבר בשימוש, ואין כללים ברורים מה מותר להכניס אליהם ומה אסור.")],
  get_k="מה מקבלים", get_h="המשימות מהמודעה, מהיום הראשון.",
  get_lead="אלה המשימות שמופיעות במודעות דרושים לתפקידי AI בארגונים. כך מהנדס של MLAIA מכסה אותן.",
  gets=[("מיפוי ותעדוף מקרי שימוש","עוברים על התהליכים והנתונים ומדרגים את מקרי השימוש לפי ערך וסיכון. יודעים מה לבנות קודם ומה לדחות.",[]),
        ("פיילוט שמגיע לייצור","פיילוט עם מדדי הצלחה שנקבעים מראש. מה שעובד עובר לייצור, עם הרשאות, ניטור ובעלות ברורה.",[]),
        ("RAG, עוזרים וסוכנים","עוזרים וסוכני AI שמחוברים למערכות שכבר יש לכם: ERP, CRM, מסמכים ונהלים.",[("ultrabot","עוזרי ידע ארגוניים ב-Ultrabot",True)]),
        ("חיזוי ומודלים על הנתונים","חיזוי ביקוש, מכירות, נטישה ומלאי, ומודלים שנבנים על הנתונים של הארגון.",[("predict","חיזוי וניתוח סיבתי ←",False),("https://nextdemand.ai/","NextDemand",True)]),
        ("מדיניות שימוש ואבטחה","מדיניות שימוש ב-AI ובנתונים, מותאמת לתיקון 13 לחוק הגנת הפרטיות ולנהלי אבטחת המידע שלכם.",[]),
        ("הדרכת עובדים לפי תפקיד","סדנאות וליווי לפי תפקיד, על משימות מהעבודה של כל צוות, בכלים שאושרו בארגון.",[("adoption","הטמעת AI בארגון ←",False)]),
        ("העברת ידע למי שתגייסו","קוד, תיעוד ותהליכים מסודרים, וחפיפה לאיש ה-AI שתגייסו בהמשך.",[])],
  get_cta=("לא בטוחים מה מזה אתם צריכים?","בשיחה של 20 דקות נבין מה הארגון מחפש, ונגיד מה היינו עושים בחודש הראשון.","לתיאום שיחה ←"),
  cmp_k="גיוס או MLAIA", cmp_h="להשוות לפני שמחליטים.", cmp_cap="השוואה בין גיוס עובד AI לבין מהנדס AI של MLAIA",
  cmp_cols=("","גיוס עובד","מהנדס AI של MLAIA"),
  cmp=[("זמן עד שמתחילים","חיפוש, ראיונות, הודעה מוקדמת וקליטה","מתחילים אחרי שיחת היכרות ותיאום, בלי תהליך גיוס"),
       ("עלות","משכורת קבועה ועלויות העסקה","היקף גמיש, לפי מספר הימים בשבוע"),
       ("מומחיות","אדם אחד, עם הניסיון שהביא איתו","מהנדס, ומאחוריו צוות: חיזוי, סוכנים ועוזרים, אודיו ו-AI רפואי"),
       ("אם הוא עוזב","הידע יוצא איתו, והגיוס מתחיל מחדש","העבודה מתועדת, והצוות ממשיך אותה"),
       ("התחייבות","חוזה העסקה","חודש של מיפוי ופיילוט, ואז מחליטים יחד על ההמשך")],
  cmp_note="אפשר גם לשלב: להתחיל איתנו עכשיו ולהמשיך לגייס במקביל.",
  how_k="איך עובדים", how_h="מתחילים בחודש אחד.",
  steps=[("ימים קבועים","מספר ימים קבוע בשבוע, אצלכם במשרד או מרחוק, לפי מה שמתאים לצוותים."),
         ("החודש הראשון","מיפוי של מקרי השימוש ופיילוט אחד, עם מדדי הצלחה שנקבעים מראש."),
         ("מפיילוט לייצור","מה שהוכיח את עצמו עובר לייצור, ואחריו מקרה השימוש הבא ברשימה."),
         ("במקביל לגיוס","אם אתם מגייסים, ממשיכים במקביל, ובסוף מעבירים את העבודה, הקוד והתיעוד לעובד החדש.")],
  faq_k="שאלות נפוצות", faq_h="תשובות ישירות.",
  faq=[("אתם מחליפים גיוס?","לא. אפשר להתחיל עכשיו ולהמשיך לגייס במקביל. כשהעובד שלכם מגיע, אנחנו מעבירים לו את העבודה, הקוד והתיעוד, ואפשר להמשיך איתנו כצוות תומך."),
       ("הנתונים יוצאים מהארגון?","לא חייבים. אפשר לבנות ולהריץ את הפתרונות בענן של הארגון או בשרתים שלו (on-prem), ולעבוד רק עם כלים ומודלים שאושרו אצלכם."),
       ("לאילו ארגונים זה מתאים?","לכל ארגון עם תהליכים ונתונים, גם כשהוא לא חברת טכנולוגיה: ביטוח ופיננסים, בריאות ופארמה, תעשייה, קמעונאות ויבוא, תחבורה ומגזר ציבורי."),
       ("יש התחייבות מינימלית?","מתחילים מחודש אחד של מיפוי ופיילוט. בסופו מחליטים יחד אם להמשיך, ובאיזה היקף."),
       ("מי המהנדס שיגיע?","מהנדס AI מהצוות של MLAIA. מאחוריו עומדים מהנדסי AI בוגרי האוניברסיטאות המובילות בארץ, ומובילי AI עם יותר מ-20 שנות ניסיון בתפקידי פיתוח וניהול.")],
  c_h="לשיחה של 20 דקות על AI בארגון שלכם.",
  c_p="ספרו לנו איזו משרה אתם מנסים לאייש, או מה אתם רוצים ש-AI יעשה אצלכם. נחזור אליכם לתיאום שיחה.",
  c_safe="נא לא לצרף מסמכים חסויים, פרטי התחברות או מידע אישי על עובדים או לקוחות.",
  c_wa="ווטסאפ:", f_name="שם", f_co="חברה", f_email="אימייל בעבודה", f_msg="מה אתם מחפשים: התפקיד, הצוותים או המשימות",
  f_priv='הפנייה שלכם מטופלת בהתאם ל<a href="/privacy.html">מדיניות הפרטיות</a> שלנו <span class="he-en">(באנגלית)</span>.',
  f_btn="לתיאום שיחה ←", crumb="פירורי לחם",
 ),
 "en": dict(
  path="/ai-engineer/", alt="/he/ai-engineer/", adoption="/ai-adoption/", predict="/predictive-intelligence/",
  ultrabot="https://ultrabot.ai/knowledge-assistant/", home="/",
  title="AI Engineer for Your Organisation, Without a Six-Month Hire | MLAIA",
  desc="An MLAIA AI engineer embedded in your organisation, with a team of AI scientists behind them: use-case mapping, pilots that reach production, RAG and agents on your systems, forecasting, an Amendment 13 usage policy and staff training.",
  service="AI Engineer for Organisations", og="ai-engineer.png", locale="en_US",
  kicker="AI engineer for organisations",
  h1='An AI engineer for your organisation, <span class="c-accent">without a six-month hire.</span>',
  audience="For executives, CIOs and innovation leads in organisations looking for an AI person.",
  lead="An MLAIA AI engineer works inside your organisation, with a team of AI scientists behind them. Together with you they choose what is worth building, and then build it all the way to production: assistants and agents on your systems, forecasting models, a usage policy and training for your staff.",
  cta1='Book a 20-minute call <span aria-hidden="true">↗</span>', cta2="Message us on WhatsApp",
  specs_title="The role, as a service",
  specs=[("The role","Strategy and hands-on building in one engineer, with a team behind them"),("The start","Mapping and one pilot in the first month"),("The scope","Fixed days per week, on site or remote")],
  pain_k="Sound familiar?", pain_h="The job is open, and AI is waiting.",
  pains=[("The job has been open for months","You advertised for an AI Lead, AI Enablement or AI architect role, and the right person has not turned up yet."),
         ("You need strategic and hands-on","The person who decides what is worth building and the person who can build it end to end are usually two different people."),
         ("A pilot that never reached production","The demo worked, then it stalled on permissions, integration and the question of who maintains it."),
         ("Staff on ChatGPT without a policy","The tools are already in use, and there are no clear rules on what may go into them.")],
  get_k="What you get", get_h="The duties from the job ad, from day one.",
  get_lead="These are the duties listed in job ads for AI roles in organisations. This is how an MLAIA engineer covers them.",
  gets=[("Mapping and prioritising use cases","We go through your processes and data and rank use cases by value and risk, so you know what to build first and what to leave.",[]),
        ("A pilot that reaches production","A pilot with success measures set in advance. What works goes to production, with permissions, monitoring and clear ownership.",[]),
        ("RAG, assistants and agents","AI assistants and agents connected to the systems you already run: ERP, CRM, documents and procedures.",[("ultrabot","Knowledge assistants on Ultrabot",True)]),
        ("Forecasting and data models","Forecasts of demand, sales, churn and inventory, and models built on your organisation's data.",[("predict","Prediction & causal analysis →",False),("https://nextdemand.ai/","NextDemand",True)]),
        ("Usage policy and security","An AI and data usage policy aligned with Israel's Privacy Protection Law Amendment 13 and your security procedures.",[]),
        ("Training staff by role","Workshops and coaching by role, on tasks from each team's own work, in the tools your organisation approved.",[("adoption","AI adoption →",False)]),
        ("Handover to the person you hire","Clean code, documentation and processes, and a handover to the AI hire you make later.",[])],
  get_cta=("Not sure which of these you need?","In a 20-minute call we will understand what you are looking for and tell you what we would do in the first month.","Book a call →"),
  cmp_k="Hire or MLAIA", cmp_h="Compare before you decide.", cmp_cap="Comparison of hiring an AI employee and an MLAIA AI engineer",
  cmp_cols=("","Hiring","An MLAIA AI engineer"),
  cmp=[("Time to start","Search, interviews, notice period and onboarding","Start after an intro call and scheduling, with no hiring process"),
       ("Cost","Fixed salary and employment costs","Flexible scope, by days per week"),
       ("Expertise","One person, with the experience they bring","An engineer with a team behind them: forecasting, agents and assistants, audio and medical AI"),
       ("If they leave","The knowledge leaves with them and hiring starts again","The work is documented and the team carries it on"),
       ("Commitment","An employment contract","A month of mapping and a pilot, then we decide together")],
  cmp_note="You can also combine the two: start with us now and keep hiring in parallel.",
  how_k="How we work", how_h="It starts with one month.",
  steps=[("Fixed days","A fixed number of days per week, at your office or remote, whichever suits your teams."),
         ("The first month","Mapping your use cases and one pilot, with success measures set in advance."),
         ("From pilot to production","What proves itself goes to production, then the next use case on the list."),
         ("Alongside hiring","If you are hiring, we work in parallel and hand the work, code and documentation to your new hire.")],
  faq_k="Common questions", faq_h="Straight answers.",
  faq=[("Do you replace hiring?","No. You can start now and keep hiring in parallel. When your hire arrives we hand over the work, code and documentation, and you can keep us on as a supporting team."),
       ("Does our data leave the organisation?","It does not have to. The solutions can be built and run in your own cloud or on-prem, using only tools and models your organisation approved."),
       ("Which organisations is this for?","Any organisation with processes and data, including ones that are not tech companies: insurance and finance, health and pharma, manufacturing, retail and import, transport and the public sector."),
       ("Is there a minimum commitment?","We start with one month of mapping and a pilot. At the end of it we decide together whether to continue, and at what scope."),
       ("Who is the engineer?","An AI engineer from the MLAIA team. Behind them are AI engineers from Israel's leading universities, and AI leads with more than 20 years in development and management roles.")],
  c_h="Book a 20-minute call about AI in your organisation.",
  c_p="Tell us which role you are trying to fill, or what you want AI to do for you. We will get back to you to set up a call.",
  c_safe="Please don’t include confidential documents, credentials or personal information about employees or customers.",
  c_wa="WhatsApp:", f_name="Name", f_co="Company", f_email="Work email", f_msg="What you are looking for: the role, the teams or the tasks",
  f_priv='Your inquiry is handled under our <a href="/privacy.html">Privacy Policy</a>.',
  f_btn="Book a call →", crumb="Breadcrumb",
 ),
}

def shell(lang):
    """Head fonts/css, quick nav, header nav, footer and cookie dialog, taken from the AI adoption page."""
    src = open(os.path.join(ROOT, "he/ai-adoption/index.html" if lang == "he" else "ai-adoption/index.html"), encoding="utf-8").read()
    fonts = re.search(r'<link rel="preconnect".*?<script src="/assets/practice.js" defer></script>(?:<script src="/assets/c-he.js" defer></script>)?', src, re.S).group(0)
    fonts = fonts.replace('<script src="/assets/c-he.js" defer></script>', '')
    quick = re.search(r'<nav class="site-quick-nav".*?</nav>\n<a class="c-skip".*?</a>\n<header class="c-nav">.*?</header>', src, re.S).group(0)
    quick = quick.replace(' aria-current="page"', '')
    quick = quick.replace('href="/he/ai-adoption/" hreflang="he"', 'href="/he/ai-engineer/" hreflang="he"')
    quick = quick.replace('href="/ai-adoption/" hreflang="en"', 'href="/ai-engineer/" hreflang="en"')
    tail = src[src.index('<footer class="c-footer">'):]
    return fonts, quick, tail

def link(t, key, text, ext):
    href = t.get(key, key)
    if ext:
        arrow = "↖" if t is T["he"] else "↗"
        return f'<a class="c-link" href="{href}" target="_blank" rel="noopener">{html.escape(text)} <span aria-hidden="true">{arrow}</span></a>'
    return f'<a class="c-link" href="{href}">{html.escape(text)}</a>'

def build(lang):
    t = T[lang]
    he = lang == "he"
    url = BASE + t["path"]
    fonts, quick, tail = shell(lang)
    esc = html.escape
    jl = lambda o: '<script type="application/ld+json">' + json.dumps(o, ensure_ascii=False, separators=(",", ":")) + "</script>"
    ld = [
        jl({"@context": "https://schema.org", "@type": "Service", "name": "MLAIA " + t["service"], "serviceType": t["service"],
            "description": t["desc"], "url": url, "inLanguage": lang, "areaServed": "IL",
            "provider": {"@type": "Organization", "@id": BASE + "/#organization", "name": "MLAIA Data Science", "url": BASE + "/"}}),
        jl({"@context": "https://schema.org", "@type": "FAQPage", "inLanguage": lang,
            "mainEntity": [{"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in t["faq"]]}),
        jl({"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "MLAIA", "item": BASE + "/"},
            {"@type": "ListItem", "position": 2, "name": t["service"] if not he else t["kicker"], "item": url}]}),
    ]
    rtl = ' dir="rtl"' if he else ""
    head = (f'<!doctype html>\n<html lang="{lang}"{rtl}><head><meta charset="UTF-8">'
            f'<meta name="viewport" content="width=device-width,initial-scale=1"><title>{esc(t["title"])}</title>'
            f'<meta name="description" content="{esc(t["desc"])}"><meta name="robots" content="index, follow">'
            f'<link rel="canonical" href="{url}">'
            f'<link rel="alternate" hreflang="he" href="{BASE}/he/ai-engineer/"><link rel="alternate" hreflang="en" href="{BASE}/ai-engineer/">'
            f'<link rel="alternate" hreflang="x-default" href="{BASE}/ai-engineer/">'
            f'<meta property="og:title" content="{esc(t["title"])}"><meta property="og:description" content="{esc(t["desc"])}">'
            f'<meta property="og:type" content="website"><meta property="og:locale" content="{t["locale"]}"><meta property="og:url" content="{url}">'
            f'<meta property="og:image" content="{BASE}/assets/og/{t["og"]}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">'
            f'<meta name="twitter:card" content="summary_large_image"><meta name="twitter:image" content="{BASE}/assets/og/{t["og"]}">'
            f'{fonts}<style>{CSS}</style><link rel="stylesheet" href="/assets/site-shell.css"><script src="/assets/site-shell.js" defer></script>'
            + "".join(ld) + "\n</head>\n")
    arrow_in = "←" if he else "→"
    specs = "".join(f"<div><dt>{esc(a)}</dt><dd>{esc(b)}</dd></div>" for a, b in t["specs"])
    pains = "".join(f'<article class="c-cell"><span class="c-cell__num">{i:02d}</span><h3>{esc(h)}</h3><p>{esc(p)}</p></article>' for i, (h, p) in enumerate(t["pains"], 1))
    gets = ""
    for i, (h, p, links) in enumerate(t["gets"], 1):
        ls = "".join(link(t, k, x, ext) + " " for k, x, ext in links).strip()
        gets += f'<article class="c-cell"><span class="c-cell__num">{i:02d}</span><h3>{esc(h)}</h3><p>{esc(p)}</p>' + (f'<p class="c-links">{ls}</p>' if ls else "") + "</article>\n      "
    gh, gp, gl = t["get_cta"]
    gets += f'<article class="c-cell e-cta"><h3>{esc(gh)}</h3><p>{esc(gp)}</p><a class="c-link" href="#contact" data-book>{esc(gl)}</a></article>'
    c0, c1, c2 = t["cmp_cols"]
    rows = "".join(f'<tr><th scope="row">{esc(r)}</th><td data-label="{esc(c1)}">{esc(a)}</td><td class="e-us" data-label="{esc(c2)}">{esc(b)}</td></tr>' for r, a, b in t["cmp"])
    steps = "".join(f'<article class="c-step"><span class="c-step__num" aria-hidden="true">{i:02d}</span><h3>{esc(h)}</h3><p>{esc(p)}</p></article>' for i, (h, p) in enumerate(t["steps"], 1))
    faq = "".join(f"<details><summary>{esc(q)}</summary><p>{esc(a)}</p></details>\n      " for q, a in t["faq"])
    ltr = ' class="ltr"' if he else ""
    body = f"""<body class="practice-page engineer c-page" data-practice="ai-engineer" data-site-shell="true">
{quick}

<main id="main">
<section class="c-hero" aria-labelledby="hero-title">
  <div class="c-wrap c-hero__copy">
    <nav class="c-crumb" aria-label="{t['crumb']}"><a href="{t['home']}">MLAIA</a> / <span>{esc(t['kicker'])}</span></nav>
    <p class="c-kicker">{esc(t['kicker'])}</p>
    <h1 class="c-display" id="hero-title">{t['h1']}</h1>
    <div class="c-hero__row">
      <div class="e-intro">
        <p class="e-audience">{esc(t['audience'])}</p>
        <p>{esc(t['lead'])}</p>
      </div>
      <div class="c-btns">
        <a href="#contact" class="c-btn" data-book>{t['cta1']}</a>
        <a href="{WA}" class="c-btn c-btn--ghost" target="_blank" rel="noopener" data-book>{esc(t['cta2'])}</a>
      </div>
    </div>
    <h2 class="c-specs-title">{esc(t['specs_title'])}</h2>
    <dl class="c-specs">{specs}</dl>
  </div>
</section>

<section class="c-sec" id="familiar" aria-labelledby="familiar-title">
  <div class="c-wrap">
    <div class="c-head">
      <p class="c-kicker"><span class="c-idx">01</span> {esc(t['pain_k'])}</p>
      <h2 class="c-h2" id="familiar-title">{esc(t['pain_h'])}</h2>
    </div>
    <div class="c-cells c-cells--4">{pains}</div>
  </div>
</section>

<section class="c-sec c-sec--alt" id="what-you-get" aria-labelledby="get-title">
  <div class="c-wrap">
    <div class="c-head">
      <p class="c-kicker"><span class="c-idx">02</span> {esc(t['get_k'])}</p>
      <h2 class="c-h2" id="get-title">{esc(t['get_h'])}</h2>
      <p class="c-lead">{esc(t['get_lead'])}</p>
    </div>
    <div class="c-cells c-cells--4">
      {gets}
    </div>
  </div>
</section>

<section class="c-sec" id="compare" aria-labelledby="compare-title">
  <div class="c-wrap">
    <div class="c-head">
      <p class="c-kicker"><span class="c-idx">03</span> {esc(t['cmp_k'])}</p>
      <h2 class="c-h2" id="compare-title">{esc(t['cmp_h'])}</h2>
    </div>
    <div class="e-table-wrap">
      <table class="e-table">
        <caption>{esc(t['cmp_cap'])}</caption>
        <thead><tr><td></td><th scope="col">{esc(c1)}</th><th scope="col" class="e-us">{esc(c2)}</th></tr></thead>
        <tbody>{rows}</tbody>
      </table>
    </div>
    <p class="e-note">{esc(t['cmp_note'])}</p>
  </div>
</section>

<section class="c-sec c-sec--alt" id="how" aria-labelledby="how-title">
  <div class="c-wrap">
    <div class="c-head">
      <p class="c-kicker"><span class="c-idx">04</span> {esc(t['how_k'])}</p>
      <h2 class="c-h2" id="how-title">{esc(t['how_h'])}</h2>
    </div>
    <div class="c-steps e-steps">{steps}</div>
  </div>
</section>

<section class="c-sec" id="faq" aria-labelledby="faq-title">
  <div class="c-wrap">
    <div class="c-head">
      <p class="c-kicker"><span class="c-idx">05</span> {esc(t['faq_k'])}</p>
      <h2 class="c-h2" id="faq-title">{esc(t['faq_h'])}</h2>
    </div>
    <div class="c-faq">
      {faq}
    </div>
  </div>
</section>

<section class="c-contact" id="contact" aria-labelledby="contact-title">
  <div class="c-wrap c-contact__grid">
    <div class="c-contact__copy">
      <p class="c-kicker">{esc(t['kicker'])}</p>
      <h2 class="c-h2" id="contact-title">{esc(t['c_h'])}</h2>
      <p>{esc(t['c_p'])}</p>
      <p>{esc(t['c_safe'])}</p>
      <p class="c-mono"><a href="mailto:yochai@mlaia.com"{ltr}>yochai@mlaia.com</a><br>{t['c_wa']} <a href="{WA}" target="_blank" rel="noopener"{ltr} data-book>+972 52 484 6282</a></p>
    </div>
    <form class="p-form c-form" action="https://formspree.io/f/mvzdggyq" method="POST">
      <input type="hidden" name="practice" value="ai-engineer">
      <input type="hidden" name="lang" value="{lang}">
      <div class="c-form__row">
        <label>{t['f_name']}<input name="name" autocomplete="name" required></label>
        <label>{t['f_co']}<input name="company" autocomplete="organization"></label>
      </div>
      <label>{t['f_email']}<input type="email" name="email" autocomplete="email" required></label>
      <label>{esc(t['f_msg'])}<textarea name="message" required></textarea></label>
      <p>{t['f_priv']}</p>
      <button type="submit" class="c-btn">{esc(t['f_btn'])}</button>
      <p class="p-form-status" role="status" aria-live="polite"></p>
    </form>
  </div>
</section>
</main>

"""
    out = os.path.join(ROOT, t["path"].strip("/"), "index.html")
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(out, "w", encoding="utf-8") as f:
        f.write(head + body + tail)
    print("wrote", os.path.relpath(out, ROOT))

if __name__ == "__main__":
    for lang in ("he", "en"):
        build(lang)
