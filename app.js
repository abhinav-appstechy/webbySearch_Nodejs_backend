const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const axios = require("axios");
const cheerio = require("cheerio");
const connectDB = require("./db");
const websiteCrawl = require("./models/websiteCrawlSchema");
const Fuse = require("fuse.js");

const app = express();
app.use(cors());

// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }));

// parse application/json
app.use(bodyParser.json());

function extractMainSiteAddress(url) {
  try {
    const urlObj = new URL(url);
    return `${urlObj.protocol}//${urlObj.hostname}`;
  } catch (error) {
    console.error("Invalid URL:", error);
    return null; // or handle the error as needed
  }
}

app.post("/scrap", async (req, res) => {
  await connectDB();
  try {
    const siteUrl = extractMainSiteAddress(req.body.site_url);
    console.log("siteUrl", siteUrl);
    // const siteUrl =
    //   "https://www.freecodecamp.org/news/building-chrome-extension/";
    // console.log(siteUrl);

    // Check if the website is already crawled in the db or not
    const isWebsiteAlreadyCrawled = await websiteCrawl.findOne({
      website_url: { $eq: siteUrl },
    });

    if (isWebsiteAlreadyCrawled) {
      return res.status(200).json({
        status: "already present",
        data: {
          message: "You have already crawled this website!",
        },
      });
    } else {
      let xmlLinks = [];

      // array to store 25 links of the website-
      let allLinksOfSite = [];

      // data format to store in db
      let allDataOfSite = {
        website_url: siteUrl,
        website_links_data: [],
      };

      // Fetch the sitemap index XML
      try {
        const { data } = await axios.get(`${siteUrl}/sitemap.xml`);
        // console.log(data);
        const $ = cheerio.load(data, { xmlMode: true });

        // Extract XML links from the sitemap index
        // $("sitemap loc").each((index, element) => {
        //   const link = $(element).text();
        //   // console.log("link:", link);
        //   xmlLinks.push(link);
        // });

        if ($("sitemap loc").length > 0) {
          $("sitemap loc").each((index, element) => {
            const link = $(element).text();
            xmlLinks.push(link);
          });

          // console.log(xmlLinks);

          try {
            if (xmlLinks.length > 0) {
              let shouldBreak = false;

              for (const xmlLink of xmlLinks) {
                if (shouldBreak) break;

                // console.log(xmlLink);
                const { data } = await axios.get(xmlLink);
                const $ = cheerio.load(data, { xmlMode: true });

                $("url loc").each((index, element) => {
                  if (allLinksOfSite.length === 25) {
                    shouldBreak = true;
                    return false; // Break out of the inner each loop
                  } else {
                    allLinksOfSite.push($(element).text());
                  }
                });
              }

              console.log(allLinksOfSite);
            }
          } catch (error) {
            console.error("Error fetching sitemap:", error);
            return res.status(500).json({
              status: "error",
              message: "Error fetching sitemap",
            });
          }
        } else {
          // Handle <url> tags directly
          $("url loc").each((index, element) => {
            const link = $(element).text();
            if (allLinksOfSite.length == 25) {
              return false;
            } else {
              allLinksOfSite.push(link);
            }
          });
        }

        // console.log(allLinksOfSite);
        // return false;

        try {
          if (allLinksOfSite.length > 0) {
            // console.log(allLinksOfSite);

            // console.log(allLinksOfSite.length);

            let allDataOfSite = {
              website_url: siteUrl,
              website_links_data: [],
            };

            try {
              if (allLinksOfSite.length > 0) {
                for (const link of allLinksOfSite) {
                  const response = await axios.get(link);
                  const html = response.data;
                  const $ = cheerio.load(html);

                  const links = [];
                  const titleContent = $("title").text();
                  // console.log(titleContent);
                  const bodyContent = $("body").html();

                  // Extract meta tag information
                  const metaTags = {
                    site_name:
                      $('meta[property="og:site_name"]').attr("content") ||
                      null,
                    type: $('meta[property="og:type"]').attr("content") || null,
                    site_icon: $('link[rel="icon"]').attr("href") || null,
                    title:
                      $('meta[property="og:title"]').attr("content") || null,
                    image:
                      $('meta[property="og:image"]').attr("content") || null,
                    description:
                      $('meta[property="og:description"]').attr("content") ||
                      null,
                    author: $('meta[name="author"]').attr("content") || null,
                    author_url:
                      $('meta[property="article:author"]').attr("content") ||
                      null,
                    url: $('meta[property="og:url"]').attr("content") || null,
                    published_time:
                      $('meta[property="article:published_time"]').attr(
                        "content"
                      ) || null,
                    modified_time:
                      $('meta[property="article:modified_time"]').attr(
                        "content"
                      ) || null,
                    keywords: $('meta[name="keywords"]').attr("content")
                      ? $('meta[name="keywords"]')
                          .attr("content")
                          .split(",")
                          .map((keyword) => keyword.trim())
                      : [],
                    tags:
                      $('meta[property="article:tag"]')
                        .map((i, el) => $(el).attr("content"))
                        .get() || null,

                    main_site_url: siteUrl,
                  };

                  let finalData = {
                    link_of_site: link,
                    title: titleContent,
                    meta_tags: metaTags,
                    site_html_structure: JSON.stringify(bodyContent),
                  };

                  allDataOfSite.website_links_data.push(finalData);
                  // console.log(finalData);

                  // return false
                }

                // console.log("allDataOfSite", allDataOfSite);
                // console.log("Exiting.......");

                // return false

                const isWebsiteAlreadyCrawled = await websiteCrawl.findOne({
                  website_url: { $eq: allDataOfSite.website_url },
                });

                // console.log(isWebsiteAlreadyCrawled);

                if (isWebsiteAlreadyCrawled) {
                  return res.status(200).json({
                    status: "success",
                    data: {
                      title: allDataOfSite.website_links_data[0].link_of_site,
                      meta_tags: allDataOfSite.website_links_data[0].meta_tags,
                      message: "You have already crawled this website!",
                    },
                  });
                } else {
                  try {
                    const newWebPage = new websiteCrawl({
                      website_url: allDataOfSite.website_url,
                      website_links_data: allDataOfSite.website_links_data,
                    });

                    await newWebPage.save();
                    return res.status(200).json({
                      status: "success",
                      data: {
                        title: allDataOfSite.website_links_data[0].link_of_site,
                        meta_tags:
                          allDataOfSite.website_links_data[0].meta_tags,
                        message: "You have successfully crawled this webpage!",
                      },
                    });
                  } catch (error) {
                    console.log(error);
                    return res.status(500).json({
                      status: "error",
                      message: "Error storing data",
                    });
                  }
                }
              }
            } catch (error) {
              console.log(error);
              return res.status(500).json({
                status: "error",
                message: "Error parsing website",
              });
            }
          }
        } catch (error) {
          console.error("Error fetching sitemap:", error);
          return res.status(500).json({
            status: "error",
            message: "Error fetching sitemap",
          });
        }
      } catch (error) {
        console.error("Error fetching or parsing sitemap index XML:", error);
        return res.status(500).json({
          status: "error",
          message: "Error fetching or parsing sitemap index XML",
        });
      }

      // console.log(xmlLinks);
      // return false;

      // let allLinksOfSite = [];

      ////////////////////////////////////////////////////////////////
      // Old Logic onf only scrap single web page and store data in db
      ////////////////////////////////////////////////////////////////

      // return false;
      // console.log(siteUrl);
      // const response = await axios.get(siteUrl);
      // const html = response.data;
      // const $ = cheerio.load(html);

      // const links = [];
      // const titleContent = $("title").text();
      // // console.log(titleContent);
      // const bodyContent = $("body").html();

      // // Extract meta tag information
      // const metaTags = {
      //   site_name: $('meta[property="og:site_name"]').attr("content") || null,
      //   type: $('meta[property="og:type"]').attr("content") || null,
      //   title: $('meta[property="og:title"]').attr("content") || null,
      //   image: $('meta[property="og:image"]').attr("content") || null,
      //   description: $('meta[property="og:description"]').attr("content") || null,
      //   author: $('meta[name="author"]').attr("content") || null,
      //   author_url: $('meta[property="article:author"]').attr("content") || null,
      //   url: $('meta[property="og:url"]').attr("content") || null,
      //   published_time:
      //     $('meta[property="article:published_time"]').attr("content") || null,
      //   modified_time:
      //     $('meta[property="article:modified_time"]').attr("content") || null,
      //   keywords: $('meta[name="keywords"]').attr("content")
      //     ? $('meta[name="keywords"]')
      //         .attr("content")
      //         .split(",")
      //         .map((keyword) => keyword.trim())
      //     : [],
      //   tags:
      //     $('meta[property="article:tag"]')
      //       .map((i, el) => $(el).attr("content"))
      //       .get() || null,
      // };

      // const isWebsiteAlreadyCrawled = await websiteCrawl.findOne({
      //   url: { $eq: metaTags.url },
      // });

      // // console.log(isWebsiteAlreadyCrawled);

      // if (isWebsiteAlreadyCrawled) {
      //   return res.status(200).json({
      //     status: "success",
      //     data: {
      //       title: titleContent,
      //       meta_tags: metaTags,
      //       message: "You have already crawled this webpage!",
      //     },
      //   });
      // } else {
      //   const newWebPage = new websiteCrawl({
      //     site_title: titleContent,
      //     site_name: metaTags.site_name,
      //     type: metaTags.type,
      //     title: metaTags.title,
      //     image: metaTags.image,
      //     description: metaTags.description,
      //     author: metaTags.author,
      //     author_url: metaTags.author_url,
      //     url: metaTags.url,
      //     published_time: metaTags.published_time,
      //     modified_time: metaTags.modified_time,
      //     keywords: metaTags.keywords,
      //     tags: metaTags.tags,
      //     site_html_structure: JSON.stringify(bodyContent),
      //   });

      //   newWebPage.save();
      //   return res.status(200).json({
      //     status: "success",
      //     data: {
      //       title: titleContent,
      //       meta_tags: metaTags,
      //       message: "You have successfully crawled this webpage!",
      //     },
      //   });
      // }
    }
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      status: "error",
      message: "Sorry, not able to scrap this webpage!",
    });
  }
});

app.post("/search-query", async (req, res) => {
  try {
    await connectDB();
    const query = req.body.query;
    // Find documents matching the query
    const results = await websiteCrawl
      .find({
        $or: [
          { website_url: { $regex: query, $options: "i" } }, // Case-insensitive search for website_url
          {
            "website_links_data.link_of_site": { $regex: query, $options: "i" },
          }, // Case-insensitive search within link_of_site
          { "website_links_data.title": { $regex: query, $options: "i" } }, // Case-insensitive search within title
          {
            "website_links_data.meta_tags.site_name": {
              $regex: query,
              $options: "i",
            },
          }, // Case-insensitive search within meta_tags.site_name
          {
            "website_links_data.meta_tags.type": {
              $regex: query,
              $options: "i",
            },
          }, // Case-insensitive search within meta_tags.type
          {
            "website_links_data.meta_tags.title": {
              $regex: query,
              $options: "i",
            },
          }, // Case-insensitive search within meta_tags.title
          {
            "website_links_data.meta_tags.image": {
              $regex: query,
              $options: "i",
            },
          }, // Case-insensitive search within meta_tags.image
          {
            "website_links_data.meta_tags.description": {
              $regex: query,
              $options: "i",
            },
          }, // Case-insensitive search within meta_tags.description
          {
            "website_links_data.meta_tags.author": {
              $regex: query,
              $options: "i",
            },
          }, // Case-insensitive search within meta_tags.author
          {
            "website_links_data.meta_tags.author_url": {
              $regex: query,
              $options: "i",
            },
          }, // Case-insensitive search within meta_tags.author_url
          {
            "website_links_data.meta_tags.url": {
              $regex: query,
              $options: "i",
            },
          }, // Case-insensitive search within meta_tags.url
          {
            "website_links_data.meta_tags.published_time": {
              $regex: query,
              $options: "i",
            },
          }, // Case-insensitive search within meta_tags.published_time
          {
            "website_links_data.meta_tags.modified_time": {
              $regex: query,
              $options: "i",
            },
          }, // Case-insensitive search within meta_tags.modified_time
          {
            "website_links_data.meta_tags.keywords": {
              $regex: query,
              $options: "i",
            },
          }, // Case-insensitive search within meta_tags.keywords
          {
            "website_links_data.meta_tags.tags": {
              $regex: query,
              $options: "i",
            },
          }, // Case-insensitive search within meta_tags.tags
          {
            "website_links_data.site_html_structure": {
              $regex: query,
              $options: "i",
            },
          }, // Case-insensitive search within site_html_structure
        ],
      })
      .exec();

    // const results = await websiteCrawl.find({
    //   website_url: {$eq: "https://www.simplilearn.com"}
    // })

    // console.log(results)
    if (results.length > 0) {
      let all_resultant_data = [];
      for (result of results) {
        all_resultant_data.push(...result.website_links_data);
      }

      const fuse = new Fuse(all_resultant_data, {
        keys: [
          "link_of_site",
          "meta_tags.author",
          "meta_tags.author_url",
          "meta_tags.description",
          "meta_tagsimage",
          "meta_tags.keywords",
          "meta_tags.site_name",
          "meta_tags.tags",
          "meta_tags.title",
          "meta_tags.type",
          "meta_tags.url",
          "site_html_structure",
          "title",
        ],
        threshold: 0.4,
      });

      // 3. Now search!
      const final = fuse.search(query);
      let final_result = [];
      if (final.length > 0) {
        for (const item of final) {
          let a = {};
          a["link_of_site"] = item.item.link_of_site;
          a["meta_tags"] = item.item.meta_tags;
          a["title"] = item.item.title;

          final_result.push(a);
        }

        return res.status(200).json({
          status: "success",
          data: final_result,
        });
      } else {
        return res.status(200).json({
          status: "success",
          data: [],
        });
      }

      // console.log("results", final_result);
    } else {
      return res.status(200).json({
        status: "success",
        data: [],
      });
    }
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      status: "error",
      message: "error occured!",
    });
  }
});

app.listen(5000, () => {
  console.log("Server is running at port 5000");
});
