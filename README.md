# Mutma'innah content

Hadith of the Day for the Mutma'innah app, from **الرَّوضُ البَاسِم مِن خُلُقِ النَّبِی الخَاتِم ﷺ**
by Shaykh-ul-Islam Dr. Muhammad Tahir-ul-Qadri (Minhaj-ul-Quran Publications).

The app reads `https://hanihashmi786.github.io/mutmainnah-content/rawd/latest.json`.
This repo is public on purpose: GitHub Pages hosts it for free.

## Roz ki hadith daalna

1. github.com par is repo mein `rawd` folder kholein (phone ke browser se bhi ho jata hai).
2. **Add file → Create new file**.
3. File ka naam us din ki taareekh: `2026-10-05.txt`
4. Hadith waisi hi paste karein jaisi kitaab mein hai:

   ```
   فَصْلٌ فِي ...            (fasl, agar ho)
   حضور ﷺ کا ...            (us ka Urdu)
   (9) أَجْرُ مَنْ ...        (topic, agar ho)
   ضرورت مندوں کی ...        (us ka Urdu)
   17. عَنْ أَبِي هُرَيْرَةَ ...   (hadith, number ke saath: zaroori)
   أخرجه الطبراني ...        (takhrij)
   حضرت ابو ہریرہ ...         (Urdu tarjuma: zaroori)
   ```

5. **Commit changes**. Taqreeban 2 minute mein publish, aur 10 minute ke andar sab phones par.

Hadith us taareekh ko raat 12 baje (har user ke apne waqt se) app mein khulegi. Aage ki
taareekh wali file pehle daal sakte hain; woh apne din tak chhupi rahegi.

**Allah ke aeraab** khud lag jate hain (اللّٰه). Fasl aur topic na hon toh woh lines chhor dein.

## Agar ghalti ho

File parhi na ja sake (number wali line na mile, Urdu na mile, taareekh ghalat ho) toh
kuch bhi publish nahi hota aur GitHub email bhejta hai. **Actions** tab mein ghalti wali
file ka naam aur wajah likhi hogi. File theek kar ke dobara commit karein.

## Developer

```
node --test tools/build.test.js   # parser tests
node tools/build.js --check       # read every day file, write nothing
node tools/build.js               # build _site/rawd/latest.json + one file per month
```
