require('dotenv').config();
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const mongoose = require('mongoose');
const Location = require('../models/Location');
const serviceAreaConfig = require('../config/serviceArea');

const connectDB = require('../config/db'); // Use the existing db.js

function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
}

async function seed() {
  if (process.env.NODE_ENV === 'production' && !process.argv.includes('--force')) {
    console.error("Refusing to run in production without --force");
    process.exit(1);
  }

  await connectDB();
  console.log("Connected to DB.");

  const districtsPath = path.join(__dirname, '../data/locations/districts.json');
  const districtsData = JSON.parse(fs.readFileSync(districtsPath, 'utf8'));

  for (const d of districtsData) {
    let districtDoc = await Location.findOneAndUpdate(
      { level: 'district', slug: d.slug },
      {
        $set: {
          name: d.name,
          lat: d.lat,
          lng: d.lng,
          zone: d.zone,
          aliases: d.aliases,
          // Only activate if we have data or maybe default to false
        },
        $setOnInsert: { isServiceActive: false, waitlistCount: 0 }
      },
      { upsert: true, new: true }
    );

    const csvPath = path.join(__dirname, `../data/locations/tn/${d.slug}.csv`);
    if (!fs.existsSync(csvPath)) {
      console.log(`[SKIPPED] ${d.name.en} - No CSV found. Marking as inactive.`);
      districtDoc.isServiceActive = false;
      await districtDoc.save();
      continue;
    } else {
      districtDoc.isServiceActive = true;
      await districtDoc.save();
    }

    const rows = [];
    await new Promise((resolve, reject) => {
      fs.createReadStream(csvPath)
        .pipe(csv())
        .on('data', (data) => rows.push(data))
        .on('end', resolve)
        .on('error', reject);
    });

    const talukMap = new Map(); // slug -> ObjectId
    let villagesToInsert = [];
    const villageNamesInTaluk = new Set(); // To check duplicates within taluk: "talukSlug-villageNameEn"
    
    let skippedRows = 0;

    for (const r of rows) {
      if (!r.taluk_en || !r.name_en) {
        skippedRows++;
        continue;
      }

      const talukSlug = slugify(r.taluk_en);
      if (!talukMap.has(talukSlug)) {
        const talukDoc = await Location.findOneAndUpdate(
          { level: 'taluk', slug: talukSlug, parentId: districtDoc._id },
          {
            $set: {
              name: { en: r.taluk_en, ta: r.taluk_ta || r.taluk_en },
              radiusKm: serviceAreaConfig.DEFAULT_TALUK_RADIUS_KM
            }
          },
          { upsert: true, new: true }
        );
        talukMap.set(talukSlug, talukDoc._id);
      }

      const villageUniqKey = `${talukSlug}-${r.name_en.toLowerCase()}`;
      if (villageNamesInTaluk.has(villageUniqKey)) {
        skippedRows++;
        continue;
      }
      villageNamesInTaluk.add(villageUniqKey);

      villagesToInsert.push({
        updateOne: {
          filter: { level: 'village', parentId: talukMap.get(talukSlug), 'name.en': r.name_en },
          update: {
            $set: {
              slug: slugify(r.name_en),
              name: { en: r.name_en, ta: r.name_ta || r.name_en },
              kind: r.kind || 'village',
              lat: r.lat ? parseFloat(r.lat) : null,
              lng: r.lng ? parseFloat(r.lng) : null,
              pincode: r.pincode || null
            }
          },
          upsert: true
        }
      });
    }

    if (villagesToInsert.length > 0) {
      // batch execute
      const BATCH_SIZE = 1000;
      for (let i = 0; i < villagesToInsert.length; i += BATCH_SIZE) {
        const batch = villagesToInsert.slice(i, i + BATCH_SIZE);
        await Location.bulkWrite(batch);
      }
    }

    console.log(`[SUCCESS] ${d.name.en} - Taluks: ${talukMap.size}, Villages: ${villagesToInsert.length}, Skipped rows: ${skippedRows}`);
  }

  console.log("Seeding complete.");
  process.exit(0);
}

seed().catch(err => {
  console.error(err);
  process.exit(1);
});
