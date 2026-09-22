"use client";

import { useCallback, useEffect, useState } from "react";
import { PdfDafViewer } from "./PdfDafViewer";

const segments = [
  { ref: "Бехорот 2а:1", kind: "Мишна", text: "הַלּוֹקֵחַ עוּבַּר חֲמוֹרוֹ שֶׁל נָכְרִי, וְהַמּוֹכֵר לוֹ, אַף עַל פִּי שֶׁאֵינוֹ רַשַּׁאי, הַמִּשְׁתַּתֵּף לוֹ, וְהַמְקַבֵּל הֵימֶנּוּ, וְהַנּוֹתֵן לוֹ בְּקַבָּלָה — פָּטוּר מִן הַבְּכוֹרָה." },
  { ref: "Бехорот 2а:2", kind: "Гемара", text: "כׇּל הָנֵי לְמָה לִי?" },
  { ref: "Бехорот 2а:3", kind: "Гемара", text: "צְרִיכִי, דְּאִי תְּנָא לוֹקֵחַ — הֲוָה אָמֵינָא מִשּׁוּם דְּקָא מַיְיתֵי לַהּ לִקְדוּשָּׁה, אֲבָל מוֹכֵר דְּקָא מַפְקַע לַהּ מִקְּדוּשָּׁה — אֵימָא לִיקְנְסֵיהּ, קָא מַשְׁמַע לַן." },
  { ref: "Бехорот 2а:4", kind: "Гемара", text: "וְהַמִּשְׁתַּתֵּף לוֹ, לְמָה לִי? לְאַפּוֹקֵי מִדְּרַבִּי יְהוּדָה, דְּאָמַר: שׁוּתָּפוּת גּוֹיִ חַיֶּיבֶת בִּבְכוֹרָה, קָמַשְׁמַע לַן דִּפְטוּרָה מִן הַבְּכוֹרָה." },
  { ref: "Бехорот 2а:5", kind: "Гемара", text: "וְהַמְקַבֵּל, לְמָה לִי? מִשּׁוּם דְּקָא בָּעֵי לְמִיתְנֵי וְהַנּוֹתֵן לוֹ בְּקַבָּלָה." },
];

export default function Home() {
  const [bounds, setBounds] = useState<[number, number]>([1, 2]);
  const [dictionaryOpen, setDictionaryOpen] = useState(false);
  const [words, setWords] = useState<string[]>([]);
  const [picked, setPicked] = useState<{ text: string; x: number; y: number } | null>(null);
  const [zoom, setZoom] = useState(1.5);
  const [blockLocated, setBlockLocated] = useState(false);
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [selectedBlock, setSelectedBlock] = useState("2a:2-3");
  const locateBlock = useCallback(() => setBlockLocated(true), []);
  const selectPdfWord = useCallback((blockId: string, word: string) => {
    const [from, to = from] = blockId.split(":")[1].split("-").map(Number);
    setSelectedBlock(blockId); setSelectedWord(word); setBounds([from - 1, to - 1]);
  }, []);

  useEffect(() => {
    const savedBounds = localStorage.getItem("havruta-position");
    const savedWords = localStorage.getItem("havruta-dictionary");
    if (savedBounds) setBounds(JSON.parse(savedBounds));
    if (savedWords) setWords(JSON.parse(savedWords));
  }, []);
  useEffect(() => { localStorage.setItem("havruta-position", JSON.stringify(bounds)); }, [bounds]);
  const shrink = () => setBounds(([start, end]) => end > start ? [start + 1, end] : [start, end]);
  const expand = () => setBounds(([start, end]) => [Math.max(0, start - 1), Math.min(segments.length - 1, end + 1)]);
  const captureSelection = () => {
    const selection = window.getSelection();
    const text = selection?.toString().trim() || "";
    if (text && text.length < 80 && /[\u0590-\u05FF]/.test(text)) {
      const range = selection?.rangeCount ? selection.getRangeAt(0).getBoundingClientRect() : null;
      setPicked({ text, x: Math.min(window.innerWidth - 170, range?.left || 40), y: (range?.bottom || 90) + 8 });
    }
  };
  const saveWord = () => {
    if (!picked) return;
    const next = words.includes(picked.text) ? words : [picked.text, ...words];
    setWords(next);
    localStorage.setItem("havruta-dictionary", JSON.stringify(next));
    setPicked(null);
  };

  return <main>
    <header className="topbar">
      <div className="brand"><span className="brandMark">דף</span><span>Daf-Ru</span></div>
      <div className="progress"><span>Бехорот · глава 1</span><strong>2а</strong><span className="status"><i /> Позиция сохранена</span></div>
      <button className="iconButton" onClick={() => setDictionaryOpen(true)} aria-label="Открыть словарь">⌘ <span>Словарь</span>{words.length > 0 && <b>{words.length}</b>}</button>
    </header>

    <section className="workspace">
      <aside className="sourcePane dafPane">
        <div className="paneHeading"><div><span className="eyebrow">ОРИГИНАЛЬНЫЙ ЛИСТ</span><h1>Бехорот <b>2а</b></h1></div><span className="verified">Оригинальный PDF</span></div>
        <div className="dafToolbar"><div><span className="currentKey"><i /> Выбранный блок</span><span className="hint">Нажмите на слово Гемары</span></div><div className="zoomControls"><button onClick={() => setZoom(value => Math.max(.6, value - .15))} aria-label="Уменьшить">−</button><span>{Math.round(zoom * 100)}%</span><button onClick={() => setZoom(value => Math.min(1.8, value + .15))} aria-label="Увеличить">+</button></div></div>
        <div className="dafViewport"><PdfDafViewer zoom={zoom} selectedBlock={selectedBlock} onSelect={selectPdfWord} onBlockLocated={locateBlock} /></div>
        <div className="pageGuide"><span><b>Центр</b> Мишна и Гемара</span><span><b>Интерактивно</b> Пока только Гемара</span><span><b>Источник</b> HebrewBooks</span><a href="/bekhorot-2a.pdf" target="_blank" rel="noreferrer">Открыть оригинальный PDF ↗</a></div>
      </aside>

      <article className="studyPane" onMouseUp={captureSelection}>
        {!blockLocated ? <div className="studyWaiting"><span>Лист определяет разбор</span><h2>Находим текущий блок на оригинальной странице…</h2><p>Статья появится только после того, как позиция будет связана с текстом Гемары.</p></div> : <>
        <div className="selectionBar"><div><span className="pulse" />Логический блок <strong>2а:{bounds[0] + 1}{bounds[1] !== bounds[0] ? `–${bounds[1] + 1}` : ""}</strong>{selectedWord && <span className="pickedWord">Слово: <b lang="he" dir="rtl">{selectedWord}</b></span>}</div><div className="boundControls"><button onClick={expand}>− Расширить</button><button onClick={shrink}>Сузить +</button></div></div>
        {selectedBlock === "2a:2-3" ? <><section className="analysisCard gemaraCard">
          <div className="cardTitle"><span>01</span><div><small>ГЕМАРА</small><h2>Зачем нужны все эти случаи?</h2></div></div>
          <div className="sourceBadge"><b>DAF-RU</b><span>редакционная версия</span><time>22.09.2026</time></div>
          <div className="hebrew" lang="he" dir="rtl">כׇּל הָנֵי לְמָה לִי? צְרִיכִי, דְּאִי תְּנָא לוֹקֵחַ — הֲוָה אָמֵינָא מִשּׁוּם דְּקָא מַיְיתֵי לַהּ לִקְדוּשָּׁה, אֲבָל מוֹכֵר דְּקָא מַפְקַע לַהּ מִקְּדוּשָּׁה — אֵימָא לִיקְנְסֵיהּ, קָא מַשְׁמַע לַן.</div>
          <div className="rule" /><h3>Точный перевод</h3>
          <p>Все эти случаи — зачем они мне? Они необходимы. Ведь если бы учили только о покупающем, я бы сказал: это потому, что он приводит её к святости. Но продающий, который выводит её из святости, — можно было бы сказать: оштрафуем его. Поэтому сообщается нам, что это не так.</p>
          <div className="explanation"><span>Коротко</span><p>Мишна перечисляет и покупателя, и продавца, потому что их действия противоположны. Можно было предположить, что продавца накажут обязанностью отдать первенца коэну. Мишна исключает такой штраф.</p></div>
        </section>
        <div className="rashiHeading"><span>Раши к этому блоку</span><i>2</i></div>
        <section className="analysisCard rashiCard"><div className="rashiNumber">1</div><div className="hebrew" lang="he" dir="rtl">מייתי לה לקדושה — שתהא שובתת בשבת וכיון דמצוה עביד ליכא למיקנסיה</div><h3>Точный перевод</h3><p>«Приводит её к святости» — чтобы она отдыхала в Шаббат; а поскольку он совершает заповедь, нет оснований штрафовать его.</p><div className="explanation compact"><span>Смысл</span><p>Покупка животного у нееврея вводит его в режим еврейских обязанностей, включая покой в Шаббат.</p></div></section>
        <section className="analysisCard rashiCard"><div className="rashiNumber">2</div><div className="hebrew" lang="he" dir="rtl">אימא ליקנסיה — לפדות העובר מן העובד כוכבים וליתנו לכהן</div><h3>Точный перевод</h3><p>«Можно было бы сказать: оштрафуем его» — [обязав] выкупить зародыш у нееврея и отдать его коэну.</p><div className="explanation compact"><span>Смысл</span><p>Предполагаемый штраф возвращает первенца в сферу заповеди: продавец должен был бы выкупить его обратно и передать коэну.</p></div></section></> : <section className="analysisCard gemaraCard"><div className="cardTitle"><span>•</span><div><small>ГЕМАРА · БЛОК {selectedBlock.replace("2a", "2а")}</small><h2>Блок найден по выбранному слову</h2></div></div>{selectedBlock === "2a:4" && <div className="hebrew" lang="he" dir="rtl">וְהַמִּשְׁתַּתֵּף לוֹ, לְמָה לִי? לְאַפּוֹקֵי מִדְּרַבִּי יְהוּדָה, דְּאָמַר: שׁוּתָּפוּת גּוֹיִ חַיֶּיבֶת בִּבְכוֹרָה, קָמַשְׁמַע לַן דִּפְטוּרָה מִן הַבְּכוֹרָה.</div>}<div className="explanation"><span>Тест выбора</span><p>Слово найдено на оригинальном листе, определён блок {selectedBlock.replace("2a", "2а")} и выделение переключено на его точные границы. Разбор этого блока пока не сохранён.</p></div></section>}
        </>}
      </article>
    </section>
    {picked && <button className="saveSelection" style={{ left: picked.x, top: picked.y }} onMouseDown={(event) => event.preventDefault()} onClick={saveWord}>＋ В словарь</button>}
    {dictionaryOpen && <div className="drawerBackdrop" onClick={() => setDictionaryOpen(false)}><aside className="drawer" onClick={(event) => event.stopPropagation()}><div className="drawerHead"><div><small>ЛИЧНАЯ КОЛЛЕКЦИЯ</small><h2>Словарь</h2></div><button onClick={() => setDictionaryOpen(false)} aria-label="Закрыть">×</button></div>{words.length ? <div className="wordList">{words.map((word) => <div className="word" key={word}><span lang="he" dir="rtl">{word}</span><small>Бехорот 2а</small><button onClick={() => { const next = words.filter(item => item !== word); setWords(next); localStorage.setItem("havruta-dictionary", JSON.stringify(next)); }}>Удалить</button></div>)}</div> : <div className="empty"><b>Пока пусто</b><p>Выделите выражение в оригинале и нажмите «В словарь».</p></div>}</aside></div>}
  </main>;
}
