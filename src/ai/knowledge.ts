import type { Category } from "../domain.js";

/**
 * BookLeaf knowledge base, split by category so each prompt only carries the
 * slice it needs (token cost) instead of the whole document.
 */
export const COMPANY = `BookLeaf Publishing is a self-publishing company in India and the US. Packages: Standard Free (no upfront cost) and Bestseller Breakthrough (paid, with marketing/distribution add-ons). We handle cover design, typesetting, ISBN assignment, printing, distribution and royalty management. In-house printing facility and warehouse are in Delhi; print partners are Repro India and Epitome Books.`;

export const TONE = `- Always empathetic and professional. Authors are partners, not customers to be managed.
- Acknowledge the concern before jumping to solutions.
- Be specific: real numbers, dates and statuses, never vague reassurance.
- If it is BookLeaf's fault (delayed royalties, ISBN error), own it directly. No corporate deflection.
- If escalation/investigation is needed, give a clear timeline (e.g. "within 48 hours"), not open-ended promises.
- Always end with a clear next step for the author and/or the BookLeaf team.`;

export const POLICY: Record<Category, string> = {
  "Royalty & Payments": `- 80/20 split: 80% of net profit per book to the author, 20% to BookLeaf. Net profit = MRP minus printing cost, platform commission (Amazon/Flipkart) and shipping.
- Royalties are calculated quarterly and paid within 45 days of the quarter ending.
- Minimum payout threshold is Rs 1,000; below that, royalties roll over to the next quarter.
- Payouts are bank transfers to the account linked in the author's dashboard.
- Authors can see a per-platform royalty breakdown in their dashboard; we can share a line-by-line breakdown on request.`,
  "ISBN & Metadata Issues": `- Every book gets a unique ISBN assigned by BookLeaf, registered under BookLeaf's imprint. An ISBN under the author's own imprint must be obtained by the author independently.
- ISBN errors (duplicate, wrong book linked) are HIGH priority and escalated to the production team.
- Metadata updates (e.g. description) can be submitted via the dashboard or by emailing the team; they reflect on platforms in 3-5 business days.`,
  "Printing & Quality": `- In-house printing handles most orders; overflow or special formats go to Repro India or Epitome Books.
- Standard print turnaround: 5-7 business days from order confirmation.
- For quality issues (misprints, binding defects, colour inconsistency) BookLeaf arranges a free reprint after verification; the author may need to share photos of the defective copy.`,
  "Distribution & Availability": `- Books are listed on Amazon India, Flipkart, Amazon US, Amazon UK and the BookLeaf Store.
- New listings go live within 7-10 business days after publication is complete.
- "Unavailable" on a platform usually means a stock sync issue; the team can trigger a re-sync within 24-48 hours.`,
  "Book Status & Production Updates": `- Stages: Manuscript Received -> Editing (if opted) -> Cover Design -> Typesetting -> Proofreading -> ISBN Assignment -> Printing -> Distribution Setup -> Published & Live.
- Authors are emailed at each stage. Delays usually happen at Cover Design (waiting for author approval) and Proofreading (revision rounds).`,
  "General Inquiry": `- Metadata updates (e.g. Amazon description) can be submitted via the dashboard or by emailing the team; changes reflect on platforms in 3-5 business days.
- Authors can view royalty breakdowns in their dashboard.`,
};

/** One calibration example per category (taken from BookLeaf's sample queries). */
export const EXAMPLES: Record<Category, { query: string; reply: string }> = {
  "Royalty & Payments": {
    query:
      "I published my book 4 months ago and still haven't received any royalty. What's going on?",
    reply: `Hi Anita,\n\nI'm sorry for the worry - not hearing about your first royalty after four months is frustrating, and you deserve a clear answer. Royalties are calculated quarterly and paid within 45 days of the quarter ending, so your first payout should arrive in the window after the most recent quarter close. I'm asking our accounts team to confirm your bank details are linked and to check whether anything is holding this payment. If it is overdue on our side, we'll fix it and tell you exactly when the transfer will land.\n\nOur team will get back to you within 48 hours. In the meantime, please check that your bank details show as linked in your dashboard.\n\nTeam BookLeaf`,
  },
  "ISBN & Metadata Issues": {
    query:
      "My book is showing a different ISBN on Amazon than what is on the physical copy.",
    reply: `Hi Rahul,\n\nThank you for flagging this - a mismatched ISBN is a serious data issue and we are treating it as high priority. I'm escalating it to our production team right now so they can compare the ISBN on your listing with the one printed on your copies and correct whichever is wrong.\n\nYou'll hear from us with a resolution within 48 hours. If you can, please send a photo of the barcode page of your copy and the Amazon listing link to speed this up.\n\nTeam BookLeaf`,
  },
  "Printing & Quality": {
    query:
      "I received my author copies and the print quality is terrible. The images are blurry and pages are misaligned.",
    reply: `Hi Neha,\n\nI'm truly sorry - that is not the standard we hold ourselves to, and I understand how disappointing it is to open your author copies and find this. We will arrange a free reprint once we've verified the defect.\n\nCould you reply with a few photos of the blurry images and misaligned pages? Once we have them, the reprint takes 5-7 business days.\n\nTeam BookLeaf`,
  },
  "Distribution & Availability": {
    query:
      'My book is published but it is showing as "Currently Unavailable" on Amazon.',
    reply: `Hi Karan,\n\nThanks for letting us know, and apologies for the trouble - a book showing as unavailable is exactly what you don't want after launch. This is typically a stock sync issue between our system and the platform. I'm asking our distribution team to trigger a re-sync now.\n\nPlease expect the listing to be back within 24-48 hours; we'll message you as soon as it is live again.\n\nTeam BookLeaf`,
  },
  "Book Status & Production Updates": {
    query:
      "It's been 3 weeks and my book is still in typesetting. When will it be done?",
    reply: `Hi Divya,\n\nThanks for checking in - three weeks is long enough that you should get a straight answer. Your book is currently at the typesetting stage, and we're waiting on the proof approval to move to proofreading. Once we have it, we'll aim to finish typesetting within 5 business days.\n\nI've asked the team to send you the proof again today so we can move this forward together.\n\nTeam BookLeaf`,
  },
  "General Inquiry": {
    query:
      "Can I update the description of my book on Amazon after it is already live?",
    reply: `Hi Sana,\n\nGreat question - yes, you can. Send the updated description through your dashboard or by emailing our team, and the change typically shows on the platforms within 3-5 business days.\n\nGo ahead and submit the new text whenever you're ready and we'll take it from there.\n\nTeam BookLeaf`,
  },
};
