export default function PolicyPage() {
  return <main className="policy-page" dir="rtl">
    <article className="policy-sheet">
      <button className="policy-back" onClick={() => window.history.back()}>رجوع</button>
      <div className="policy-icon">د</div>
      <p className="policy-kicker">دجلة · سياسة المنصة</p>
      <h1>سياسة الاستخدام</h1>
      <p className="policy-lead">حتى تبقى دجلة مساحة مريحة وآمنة للجميع، نطلب منك الالتزام بهذه القواعد عند استخدام المنصة.</p>
      <section><h2>1. الحساب</h2><p>أنت مسؤول عن معلومات حسابك وكلمة المرور وعن النشاط الذي يتم من خلال حسابك.</p></section>
      <section><h2>2. المحتوى</h2><p>لا تنشر محتوى غير قانوني أو تهديدات أو احتيالاً أو انتحالاً للهوية أو محتوى ينتهك حقوق الآخرين.</p></section>
      <section><h2>3. الاحترام</h2><p>استخدم دجلة باحترام. يمنع التحرش والمضايقة وخطاب الكراهية والاستهداف المتعمد للمستخدمين.</p></section>
      <section><h2>4. الخصوصية</h2><p>لا تنشر بيانات شخصية للآخرين دون إذنهم، واحترم خصوصية الأشخاص والمحادثات.</p></section>
      <section><h2>5. الإشراف</h2><p>قد نراجع البلاغات والمحتوى المخالف ونطبق الإجراءات المناسبة، وقد يتضمن ذلك تقييد الحساب أو إيقافه وفقاً للحالة.</p></section>
      <section><h2>6. التحديثات</h2><p>قد تتغير هذه السياسة مع تطور دجلة. سنعرض النسخة الحالية داخل المنصة.</p></section>
      <div className="policy-bottom">باستخدامك دجلة، أنت توافق على سياسة الاستخدام.</div>
      <div className="policy-dijla">دجلة</div>
    </article>
  </main>;
}