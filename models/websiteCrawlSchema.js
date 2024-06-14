const mongoose = require("mongoose");
const Schema = mongoose.Schema;

// Define the schema
const websiteCrawlSchema = new Schema({
  website_url: { type: String, default: null },
  website_links_data: [{ type: Object, default: {} }],
});

// Compile the schema into a model
const websiteCrawl = mongoose.model("websiteCrawl", websiteCrawlSchema);

module.exports = websiteCrawl;
