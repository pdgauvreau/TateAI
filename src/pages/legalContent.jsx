import React from 'react'

// These are drafts written to describe accurately what the service actually does
// with data — which is the part a generic template gets wrong. They are not legal
// advice and have not been reviewed by a lawyer.

export const EFFECTIVE_DATE = 'September 9, 2026'
export const CONTACT_EMAIL = 'support@tateai.app'
export const OPERATOR = 'Paul Gauvreau'
export const STATE = 'Utah'

export const privacy = [
  {
    heading: 'Who we are',
    body: (
      <>
        TATE AI is operated by {OPERATOR}, an individual based in the United States. You can
        reach us at <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </>
    ),
  },
  {
    heading: 'What we collect',
    body: (
      <>
        <p>
          <strong>Account information.</strong> Your email address, and your name if you provide
          one. Your password is handled by our authentication provider and stored only as a hash —
          we never see or store the password itself.
        </p>
        <p>
          <strong>Materials you upload.</strong> The PDF files you upload, and the text extracted
          from them so the AI can read them.
        </p>
        <p>
          <strong>Your conversations.</strong> Every message you send and every reply you receive,
          stored so you can return to a conversation later.
        </p>
        <p>
          <strong>Nothing else.</strong> We do not use analytics, advertising, or tracking cookies.
          We do not build a profile of you beyond what is described here.
        </p>
      </>
    ),
  },
  {
    heading: 'Who else processes your data',
    body: (
      <>
        <p>
          Running this service means other companies handle your data on our behalf. They are:
        </p>
        <ul>
          <li>
            <strong>Supabase</strong> — stores your account, uploaded files, and conversations.
          </li>
          <li>
            <strong>Vercel</strong> — hosts the website and the code that talks to the AI.
          </li>
          <li>
            <strong>Anthropic</strong> — provides the AI. When you send a message, the text of the
            documents attached to that conversation and the conversation history are sent to
            Anthropic to generate a reply.
          </li>
        </ul>
        <p>
          We do not sell your data, and we do not share it with anyone beyond the providers above.
        </p>
      </>
    ),
  },
  {
    heading: 'Voice features',
    body: (
      <>
        <p>
          Dictation and read-aloud use speech features built into your web browser, not services we
          operate.
        </p>
        <p>
          <strong>This matters for your privacy:</strong> most browsers, including Google Chrome,
          send the audio from your microphone to the browser vendor&apos;s servers to convert it to
          text. That audio goes to your browser vendor under their privacy policy, not ours — we
          receive only the resulting text, and only once you send the message.
        </p>
        <p>
          If you would rather no audio leave your device, do not use the microphone button. Typing
          works identically.
        </p>
      </>
    ),
  },
  {
    heading: 'How your data is protected',
    body: (
      <>
        <p>
          Every record is subject to database-level access rules tied to your account, so one
          user&apos;s materials cannot be read by another. Uploaded files are kept in private
          storage that is not publicly accessible.
        </p>
        <p>
          No system is perfectly secure, and we cannot guarantee absolute security. TATE AI is early
          software and has not undergone an independent security audit.
        </p>
      </>
    ),
  },
  {
    heading: 'How long we keep it',
    body: (
      <>
        We keep your data until you delete it or close your account. Deleting a document or
        conversation removes it from our database and storage. Deleting your account removes your
        account and everything attached to it. Backups may persist for a short period after
        deletion.
      </>
    ),
  },
  {
    heading: 'Your choices',
    body: (
      <>
        <p>
          You can export everything we hold about you at any time from your dashboard, and you can
          delete any document or conversation from the same place. To delete your account entirely,
          email <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> and we will do it.
        </p>
        <p>
          Depending on where you live you may have additional rights over your data, including
          access, correction, and deletion. Contact us and we will honour them.
        </p>
      </>
    ),
  },
  {
    heading: 'Age requirement',
    body: (
      <>
        TATE AI is for people aged 18 and over. We do not knowingly collect information from anyone
        under 18. If you believe a minor has created an account, email us and we will remove it.
      </>
    ),
  },
  {
    heading: 'Changes',
    body: (
      <>
        If we change this policy in a way that materially affects how your data is handled, we will
        email you before it takes effect.
      </>
    ),
  },
]

export const terms = [
  {
    heading: 'Agreement',
    body: (
      <>
        By creating an account you agree to these terms. TATE AI is operated by {OPERATOR}, an
        individual based in the United States. If you do not agree, do not use the service.
      </>
    ),
  },
  {
    heading: 'Who can use TATE AI',
    body: (
      <>
        You must be 18 or older and able to enter a binding contract. One account per person. You
        are responsible for keeping your password secure and for activity under your account.
      </>
    ),
  },
  {
    heading: 'Academic integrity',
    body: (
      <>
        <p>
          TATE AI is built to help you understand your coursework, not to complete it for you. It is
          designed to ask you questions and give hints rather than hand over finished answers.
        </p>
        <p>
          <strong>You are responsible for following your institution&apos;s rules on AI use.</strong>{' '}
          Those rules vary by school, course, and instructor, and some prohibit AI assistance
          entirely. Submitting work you did not do can carry serious academic consequences. We
          cannot and do not grant permission to use this tool for any particular assignment — only
          your instructor can do that.
        </p>
      </>
    ),
  },
  {
    heading: 'Your materials',
    body: (
      <>
        <p>
          You keep ownership of everything you upload. You grant us only the permission needed to
          run the service: to store your files, extract their text, and send that text to our AI
          provider to generate replies for you. We do not use your materials to train AI models.
        </p>
        <p>
          You must have the right to upload what you upload. Course materials are often copyrighted
          by your instructor, your institution, or a publisher — uploading them for your own study
          is generally fine, but redistributing them is not, and that is on you, not us.
        </p>
      </>
    ),
  },
  {
    heading: 'Acceptable use',
    body: (
      <>
        Do not use TATE AI to break the law, infringe anyone&apos;s rights, upload malware, attempt
        to access other users&apos; data, or place automated load on the service beyond normal
        personal study. We may suspend accounts that do.
      </>
    ),
  },
  {
    heading: 'The AI can be wrong',
    body: (
      <>
        <p>
          TATE AI generates responses using a language model. It can be confidently incorrect, and
          it may misread or miss parts of your materials — long documents are shortened before the
          AI sees them, so it may not have read everything you uploaded.
        </p>
        <p>
          Do not rely on it as your only source. Check anything that matters against your actual
          course materials and your instructor. It is not a substitute for professional advice of
          any kind.
        </p>
      </>
    ),
  },
  {
    heading: 'Availability',
    body: (
      <>
        TATE AI is early software provided as is, without warranties. We do not promise it will be
        available, uninterrupted, or free of errors, and we may change or discontinue features. We
        will give reasonable notice before discontinuing the service entirely.
      </>
    ),
  },
  {
    heading: 'Limitation of liability',
    body: (
      <>
        To the fullest extent permitted by law, we are not liable for indirect or consequential
        damages, lost data, or academic outcomes arising from your use of TATE AI. Our total
        liability is limited to the amount you paid us in the twelve months before the claim, or
        USD $100 if you paid nothing.
      </>
    ),
  },
  {
    heading: 'Ending your account',
    body: (
      <>
        You can stop using TATE AI at any time and ask us to delete your account. We may suspend or
        close accounts that breach these terms, and will tell you why where we reasonably can.
      </>
    ),
  },
  {
    heading: 'Governing law',
    body: (
      <>
        These terms are governed by the laws of the State of {STATE}, United States, without regard
        to conflict-of-law rules.
      </>
    ),
  },
  {
    heading: 'Changes',
    body: (
      <>
        We may update these terms. If a change materially affects your rights, we will email you
        before it takes effect. Continuing to use TATE AI after that means you accept the change.
      </>
    ),
  },
]
