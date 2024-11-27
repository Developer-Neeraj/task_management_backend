const nodemailer = require("nodemailer");
const { smtpUserName, smtpPassword, appName } = require("../secret");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: smtpUserName,
    pass: smtpPassword,
  },
});

const sendEmailWithNodamailer = async (emailData) => {
  try {
    const mailOptions = {
      from: `${appName} ${smtpUserName}`, // sender email address
      to: emailData.email, // receiver email address
      subject: emailData.subject, // subject of email
      text: emailData.text, // text of email
      html: emailData.html, // body of email message
    };

    const info = await transporter.sendMail(mailOptions);
    // return info;
    console.log("Message sent: %s", info.response);
  } catch (error) {
    console.error("Error occurred while sending mail: ", error);
    throw error;
  }
};
module.exports = sendEmailWithNodamailer;
