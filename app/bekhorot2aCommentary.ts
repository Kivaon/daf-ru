export type CommentaryLink = {
  base: string;
  commentator: "Rashi" | "Tosafot";
  ref: string;
  text: string;
  dibur: string;
};

export const SEFARIA_LINKS_SOURCE_URL = "https://www.sefaria.org/api/links/Bekhorot.2a?with_text=1";

export const BEKHOROT_2A_COMMENTARY: CommentaryLink[] = [
  { base: "2a:1", commentator: "Rashi", ref: "Rashi on Bekhorot 2a:1:1", dibur: "מתני' הלוקח עובר חמורו", text: "מתני' הלוקח עובר חמורו - ובכור הוא ועדיין הוא במעי אמו. והאי דנקט חמור ולא נקט פרה מפרש בפירקא תנינא (לקמן בכורות יג.) דאיידי דזוטרא מילי דפטר חמור פסיק ושדי ליה וכל אינך פירקין מיירי בבכור בהמה טהורה:" },
  { base: "2a:1", commentator: "Rashi", ref: "Rashi on Bekhorot 2a:1:2", dibur: "אע\"פ שאינו רשאי", text: "אע\"פ שאינו רשאי - כדתניא במסכת ע\"ז (ד' יד:) ובכ\"מ אין מוכרין להם בהמה גסה מפני שעושה בה מלאכה בשבת:" },
  { base: "2a:1", commentator: "Rashi", ref: "Rashi on Bekhorot 2a:1:3", dibur: "והמשתתף לו", text: "והמשתתף לו - שנותנין מעות בין שניהם וקונין בהמה:" },
  { base: "2a:1", commentator: "Rashi", ref: "Rashi on Bekhorot 2a:1:4", dibur: "והמקבל בהמה ממנו", text: "והמקבל בהמה ממנו - שהחמורה של עובד כוכבים וישראל מקבלה שיהו חולקין בוולדות אבל גוף החמורה לעובד כוכבים:" },
  { base: "2a:1", commentator: "Rashi", ref: "Rashi on Bekhorot 2a:1:5", dibur: "פטור מן הבכורה", text: "פטור מן הבכורה - אם אותו עובר שקנה מן העובד כוכבים או שמכר לעובד כוכבים בכור הוא אינו קדוש הואיל ויש חלק לעובד כוכבים בו או באמו:" },
  { base: "2a:1", commentator: "Rashi", ref: "Rashi on Bekhorot 2a:1:6", dibur: "שנאמר", text: "שנאמר - הקדשתי לי כל בכור בישראל אבל לא באחרים עובדי כוכבים:" },
  { base: "2a:1", commentator: "Tosafot", ref: "Tosafot on Bekhorot 2a:1:1", dibur: "מתני' הלוקח עובר חמורו של עובד כוכבים והמוכר לו", text: "מתני' הלוקח עובר חמורו של עובד כוכבים והמוכר לו - לוקח מיפטר מבכורה משום אם שהיא של עובד כוכבים ומוכר מיפטר משום ולד של עובד כוכבים ומתרי קראי נפקי:" },
  { base: "2a:1", commentator: "Tosafot", ref: "Tosafot on Bekhorot 2a:1:2", dibur: "והמשתתף", text: "והמשתתף - בת\"כ פ' אמור בכור איתיה בשותפות מדכתיב בכורות בקרכם וצאנכם:" },
  { base: "2a:3", commentator: "Rashi", ref: "Rashi on Bekhorot 2a:3:1", dibur: "גמ' מייתי לה לקדושה", text: "גמ' מייתי לה לקדושה - שתהא שובתת בשבת וכיון דמצוה עביד ליכא למיקנסיה:" },
  { base: "2a:3", commentator: "Rashi", ref: "Rashi on Bekhorot 2a:3:2", dibur: "אימא ליקנסיה", text: "אימא ליקנסיה - לפדות העובר מן העובד כוכבים וליתנו לכהן:" },
  { base: "2a:3", commentator: "Tosafot", ref: "Tosafot on Bekhorot 2a:3:1", dibur: "מייתי לה לקדושה", text: "מייתי לה לקדושה - פ\"ה שתהא שובתת בשבת וכן מפקע לה מקדושה שהעובד כוכבים עושה בה מלאכה בשבת ולשון קדושה לא משמע כן אלא קדושת בכורה:" },
  { base: "2a:4", commentator: "Rashi", ref: "Rashi on Bekhorot 2a:4:1", dibur: "מדרבי יהודה", text: "מדרבי יהודה - דאמר לקמן המקבל בהמה מן העובד כוכבים מעלין אותו בשויו ונותן חצי דמיו לכהן:" },
  { base: "2a:4", commentator: "Tosafot", ref: "Tosafot on Bekhorot 2a:4:1", dibur: "לאפוקי מדר' יהודה", text: "לאפוקי מדר' יהודה - בלא ר' יהודה נמי איצטריך לאשמועינן שותפות דלא שמעינן ליה מרישא אלא כ\"ש איצטריך טפי כיון דמשכחת בהא פלוגתא:" },
  { base: "2a:6", commentator: "Rashi", ref: "Rashi on Bekhorot 2a:6:1", dibur: "ועיקר בהמה", text: "ועיקר בהמה - גוף הבהמה וחצי ולדות:" },
  { base: "2a:6", commentator: "Rashi", ref: "Rashi on Bekhorot 2a:6:2", dibur: "דלמא אתי לאיחלופי בבהמה אחריתי", text: "דלמא אתי לאיחלופי בבהמה אחריתי - שאין לעובד כוכבים חלק בה ולא בוולדותיה ואתי למיפטריה נמי מבכורה:" },
  { base: "2a:7", commentator: "Rashi", ref: "Rashi on Bekhorot 2a:7:1", dibur: "תנן התם", text: "תנן התם - במסכת ע\"ז (דף יד:):" },
  { base: "2a:7", commentator: "Rashi", ref: "Rashi on Bekhorot 2a:7:2", dibur: "רבי יהודה מתיר בשבורה", text: "רבי יהודה מתיר בשבורה - למכור לעובד כוכבים בהמה שנשברו רגליה ובמקום שלא נחשדו על הרביעה:" },
  { base: "2a:8", commentator: "Rashi", ref: "Rashi on Bekhorot 2a:8:1", dibur: "עובר מה לי א\"ר יהודה", text: "עובר מה לי א\"ר יהודה - למוכרו לעובד כוכבים שרי או אסור:" },
  { base: "2a:8", commentator: "Rashi", ref: "Rashi on Bekhorot 2a:8:2", dibur: "משום דשבורה", text: "משום דשבורה - ואינה ראויה למלאכה:" },
  { base: "2a:8", commentator: "Rashi", ref: "Rashi on Bekhorot 2a:8:3", dibur: "ועובר נמי שבור הוא", text: "ועובר נמי שבור הוא - אצל מלאכה:" },
  { base: "2a:8", commentator: "Rashi", ref: "Rashi on Bekhorot 2a:8:4", dibur: "או דלמא שבורה לאו היינו אורחה", text: "או דלמא שבורה לאו היינו אורחה - דבהמה להיות שבורה הלכך דבר חידוש הוא ולא אתי לאיחלופי ולהתיר מכירת שלמה:" },
  { base: "2a:8", commentator: "Tosafot", ref: "Tosafot on Bekhorot 2a:8:1", dibur: "אבל עובר כיון דהיינו אורחיה לאו שבור הוא", text: "אבל עובר כיון דהיינו אורחיה לאו שבור הוא - פירוש דאתי למיחלף בבהמה אחריתי ועוד מצי למימר משום דעתיד להוליד ולהיות ראוי למלאכה:" },
  { base: "2a:9", commentator: "Rashi", ref: "Rashi on Bekhorot 2a:9:1", dibur: "ת\"ש", text: "ת\"ש - דמיירי בעובר וקתני אינו רשאי משום מלאכת שבת:" },
  { base: "2a:10", commentator: "Rashi", ref: "Rashi on Bekhorot 2a:10:1", dibur: "וליטעמיך המשתתף לו", text: "וליטעמיך המשתתף לו - דקתני במתני' לענין בכורה דפטור ולא קתני ר' יהודה מחייב ה\"נ דלא פליג:" },
  { base: "2a:12", commentator: "Rashi", ref: "Rashi on Bekhorot 2a:12:1", dibur: "רבי יהודה אומר המקבל בהמה כו' וילדה", text: "רבי יהודה אומר המקבל בהמה כו' וילדה - בכור:" },
  { base: "2a:12", commentator: "Rashi", ref: "Rashi on Bekhorot 2a:12:2", dibur: "מעלין", text: "מעלין - שמין:" },
  { base: "2a:12", commentator: "Rashi", ref: "Rashi on Bekhorot 2a:12:3", dibur: "ונותן חצי דמיו לכהן", text: "ונותן חצי דמיו לכהן - אבל קדושת הגוף לא קדוש ליקרב למזבח הואיל וחציו לעובד כוכבים:" },
  { base: "2a:12", commentator: "Rashi", ref: "Rashi on Bekhorot 2a:12:4", dibur: "והנותן לו בקבלה", text: "והנותן לו בקבלה - נמי לא קדוש קדושת הגוף הואיל וחציו לעובד כוכבים פטור מן הבכורה:" },
  { base: "2a:12", commentator: "Rashi", ref: "Rashi on Bekhorot 2a:12:5", dibur: "קונסים אותו", text: "קונסים אותו - הואיל ולא חש לדברי חכמים:" },
  { base: "2a:12", commentator: "Tosafot", ref: "Tosafot on Bekhorot 2a:12:1", dibur: "ונותן חצי דמיו לכהן", text: "ונותן חצי דמיו לכהן - לא לקדש קדושת הגוף להיות קרב למזבח מפני חלקו של עובד כוכבים:" },
  { base: "2a:12", commentator: "Tosafot", ref: "Tosafot on Bekhorot 2a:12:2", dibur: "קונסין אותו עד עשרה בדמיו", text: "קונסין אותו עד עשרה בדמיו - דוקא בגסה קנסו אבל דקה כיון דאיסורא ליכא אלא מנהגא בעלמא:" },
];
