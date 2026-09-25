"use client";

import { useEffect, useRef } from "react";

export default function AboutProject() {
  const dialog = useRef<HTMLDialogElement>(null);
  const previousOverflow = useRef<string | null>(null);
  const restoreScroll = () => {
    if (previousOverflow.current !== null) {
      document.body.style.overflow = previousOverflow.current;
      previousOverflow.current = null;
    }
  };
  useEffect(() => restoreScroll, []);
  const open = () => {
    dialog.current?.showModal();
    previousOverflow.current = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  };

  return <>
    <button className="aboutProjectButton" onClick={open} aria-haspopup="dialog">О ПРОЕКТЕ</button>
    <dialog ref={dialog} className="aboutProjectDialog" aria-labelledby="about-project-title" onClose={restoreScroll} onClick={event => {
      if (event.target === event.currentTarget) {
        const bounds = event.currentTarget.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) event.currentTarget.close();
      }
    }}>
      <header className="aboutProjectHeader">
        <div><span>Daf-Ru</span><h1 id="about-project-title">О проекте</h1></div>
        <button autoFocus onClick={() => dialog.current?.close()} aria-label="Закрыть окно «О проекте»">×</button>
      </header>
      <div className="aboutProjectContent">
        <p className="aboutProjectLead">Daf-Ru не заменяет изучение Гемары. Он помогает к нему подготовиться.</p>
        <section><h2>Что такое Daf-Ru</h2>
          <p>Daf-Ru — вспомогательная база знаний для предварительной подготовки к изучению Гемары. Она помогает русскоязычному ученику понять текст и контекст перед полноценным изучением с преподавателем или в хавруте.</p>
        </section>
        <section><h2>Какую проблему мы решаем</h2>
          <p>Человек, свободно владеющий языком Гемары, ещё до углублённого разбора может прочитать текст и получить общее представление: о чём идёт речь, какой вопрос задаётся, что отвечает Гемара и к чему относятся комментарии.</p>
          <p>У иноязычного ученика этот предварительный этап часто отсутствует. Возникает разрыв понимания контекста: значительная часть усилий уходит на преодоление языкового барьера и попытку разобраться, о чём вообще идёт речь.</p>
        </section>
        <section><h2>Подготовка к изучению</h2>
          <p>Перед занятием ученик может пройти нужный участок Гемары и получить связное представление о тексте, контексте и ходе обсуждения. К преподавателю или хавруте он приходит уже понимая, где находится в сугии и что обсуждается.</p>
          <p>Это даёт основу для самого изучения — вопросов, анализа, сопоставления мнений и углубления в текст.</p>
        </section>
        <section><h2>Что содержит база</h2>
          <ul><li>Оригинальный текст Гемары.</li><li>Точный перевод на русский язык.</li><li>Краткое объяснение, контекст и логику обсуждения.</li><li>Связанные с выбранным фрагментом комментарии Раши, Тосафот и другие комментарии.</li><li>Перевод и краткое пояснение каждого комментария.</li></ul>
          <p>Пользователь выбирает нужное место в тексте и получает связанные с ним материалы. Оригинал всегда остаётся перед глазами.</p>
        </section>
        <section><h2>База, которую пополняет сообщество</h2>
          <p>Материалы можно добавлять по ходу изучения. Базу пополняют пользователи с соответствующими правами: преподаватели, грамотные редакторы, люди, хорошо знающие конкретную сугию, и добросовестные ученики.</p>
          <p>После проверки добавленные переводы и пояснения становятся доступны другим пользователям. Каждый разобранный участок пополняет общую базу и помогает следующим ученикам подготовиться к занятию.</p>
        </section>
        <footer className="aboutProjectFooter">Предварительное понимание текста и контекста — основа для дальнейшего изучения с преподавателем или в хавруте.</footer>
      </div>
    </dialog>
  </>;
}
