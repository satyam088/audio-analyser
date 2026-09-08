const { Resend } = require("resend");

const resend = new Resend(process.env.RESEND_API_KEY);

sendEmail = async (to, subject, html) => {
  await resend.emails.send({
    from: `"Dnosan" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    html,
  });
};

module.exports = {sendEmail}