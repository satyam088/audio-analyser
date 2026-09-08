
const emailBaseLayout = (header, content) => {
    return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>${header}</title>
      </head>

      <body style="
        margin: 0;
        padding: 0;
        background-color: #f4f4f5;
        font-family: Arial, Helvetica, sans-serif;
      ">
        
        <table
          width="100%"
          cellpadding="0"
          cellspacing="0"
          border="0"
          style="background-color: #f4f4f5; padding: 40px 0;"
        >
          <tr>
            <td align="center">
              <!-- Main Container -->
              <table
                width="600"
                cellpadding="0"
                cellspacing="0"
                border="0"
                style="
                  max-width: 600px;
                  width: 100%;
                  background-color: #ffffff;
                  border-radius: 8px;
                  overflow: hidden;
                "
              >
                <!-- Header -->
                <tr>
                  <td style="
                    background-color: #18181b;
                    padding: 25px 30px;
                    text-align: center;
                  ">
                    <div style="
                        color: #ffffff;
                        font-size: 28px;
                        font-weight: 700;
                        letter-spacing: 1px;
                        margin-bottom: 8px;
                    ">
                  Dnosan
              </div>

                <h1 style="
                  margin: 0;
                  color: #d4d4d8;
                  font-size: 20px;
                 font-weight: 500;
                ">
                  ${header}
                </h1>
                      
                    </h1>
                  </td>
                </tr>

                <!-- Content -->
                <tr>
                  <td style="
                    padding: 35px 30px;
                    color: #27272a;
                    font-size: 16px;
                    line-height: 1.6;
                  ">
                    ${content} 
                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td style="
                    padding: 20px 30px;
                    background-color: #f4f4f5;
                    text-align: center;
                    color: #71717a;
                    font-size: 12px;
                  ">
                    <p style="margin: 0;">
                      This is an automated email. Please do not reply.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>q
  `;
};

module.exports = { emailBaseLayout };
