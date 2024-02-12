// Import required modules
const express = require('express');
const bodyParser = require('body-parser');
const mysql = require('mysql');

// Create MySQL connection
const connection = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "",
  database: "fluxkart",
  connectionLimit:10
}); 

// Connect to MySQL
connection.connect(err => {
  if (err) {
    console.error('Error connecting to MySQL: ' + err.stack);
    return;
  }
  console.log('Connected to MySQL as id ' + connection.threadId);
});

// Create Express app
const app = express();
const PORT = process.env.PORT || 3007;

// Middleware
app.use(bodyParser.json());

// POST endpoint to identify and consolidate contacts
app.post('/identify', (req, res) => {
  const { email, phoneNumber } = req.body;

  // Find primary contact based on email or phoneNumber
  let query = `SELECT * FROM Contact WHERE (email = ? OR phoneNumber = ?) AND linkPrecedence = 'primary'`;
  connection.query(query, [email, phoneNumber], (err, primaryResults) => {
    if (err) {
      console.error('Error identifying primary contact: ' + err.message);
      res.status(500).json({ error: 'Internal server error' });
      return;
    }

    // If primary contact found
    if (primaryResults.length > 0) {
      const primaryContact = primaryResults[0];
      const primaryContactId = primaryContact.id;

      // Find secondary contacts linked to primary contact
      query = `SELECT * FROM Contact WHERE linkedId = ?`;
      connection.query(query, [primaryContactId], (err, secondaryResults) => {
        if (err) {
          console.error('Error identifying secondary contacts: ' + err.message);
          res.status(500).json({ error: 'Internal server error' });
          return;
        }

        // Construct response payload
        const emails = [primaryContact.email];
        const phoneNumbers = [primaryContact.phoneNumber];
        const secondaryContactIds = secondaryResults.map(contact => contact.id);

        const contactPayload = {
          primaryContatctId: primaryContactId,
          emails,
          phoneNumbers,
          secondaryContactIds
        };

        res.status(200).json({ contact: contactPayload });
      });
    } else {
      // If no primary contact found, create new primary contact
      query = `INSERT INTO Contact (email, phoneNumber, linkPrecedence) VALUES (?, ?, 'primary')`;
      connection.query(query, [email, phoneNumber], (err, results) => {
        if (err) {
          console.error('Error creating new primary contact: ' + err.message);
          res.status(500).json({ error: 'Internal server error' });
          return;
        }

        const newPrimaryContactId = results.insertId;

        // Construct response payload for new contact
        const contactPayload = {
          primaryContatctId: newPrimaryContactId,
          emails: [email],
          phoneNumbers: [phoneNumber],
          secondaryContactIds: []
        };

        res.status(200).json({ contact: contactPayload });
      });
    }
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
