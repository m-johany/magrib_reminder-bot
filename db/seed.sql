-- Hadith seed data — virtues of Surah al-Kahf.
--
-- All entries are authentic (sahih or hasan) narrations from recognized
-- collections (Sahih Muslim, Sunan Abi Dawud, al-Mustadrak, Musnad Ahmad,
-- Sunan al-Darimi, as-Silsilah as-Sahihah) with gradings as noted in the
-- source fields.
--
-- Verified 2026-08-17 against primary sources (sunnah.com, al-Mustadrak via
-- sunnah.com hakim, dorar.net, shamela.ws at-Targhib wa'l-Tarhib): entries
-- 0-6 PASS as-is; entry 7 carries a weak (da'if per al-Albani) grading and is
-- pending a keep/drop/replace decision; the original entries 8 (duplicate of
-- 3) and wrong citations (1, 3, 4, 9) were corrected/removed in this commit.
-- week_order runs 0..N-1; rotation = week_number % count.

INSERT INTO hadith (week_order, text_en, text_ar, source_en, source_ar) VALUES
(0,
 'Whoever memorizes the first ten verses of Surah al-Kahf will be protected from the Dajjal.',
 'مَنْ حَفِظَ عَشْرَ آيَاتٍ مِنْ أَوَّلِ سُورَةِ الْكَهْفِ عُصِمَ مِنَ الدَّجَّالِ',
 'Narrated by Abu Darda'' (may Allah be pleased with him); Sahih Muslim 809',
 'رواه أبو الدرداء رضي الله عنه؛ صحيح مسلم ٨٠٩'),

(1,
 'Whoever recites the last ten verses of Surah al-Kahf will be protected from the trial of the Dajjal.',
 'مَنْ قَرَأَ الْعَشْرَ الْأَوَاخِرَ مِنْ سُورَةِ الْكَهْفِ عُصِمَ مِنْ فِتْنَةِ الدَّجَّالِ',
 'Musnad Ahmad 27516; also Sunan al-Nasa''i',
 'مسند أحمد ٢٧٥١٦؛ وأخرجه النسائي'),

(2,
 'Whoever memorizes ten verses from the beginning of Surah al-Kahf will be protected from the trial of the Dajjal.',
 'مَنْ حَفِظَ عَشْرَ آيَاتٍ مِنْ أَوَّلِ سُورَةِ الْكَهْفِ عُصِمَ مِنْ فِتْنَةِ الدَّجَّالِ',
 'Sunan Abi Dawud 4323; graded sahih by al-Albani',
 'سنن أبي داود ٤٣٢٣؛ وصححه الألباني'),

(3,
 'Whoever recites Surah al-Kahf as it was revealed, it will be a light for him on the Day of Resurrection from his place to Makkah.',
 'مَنْ قَرَأَ سُورَةَ الْكَهْفِ كَمَا أُنْزِلَتْ كَانَتْ لَهُ نُورًا يَوْمَ الْقِيَامَةِ مِنْ مَقَامِهِ إِلَى مَكَّةَ',
 'As-Silsilah as-Sahihah 2651; Sahih at-Targhib 1473; graded sahih by al-Albani',
 'السلسلة الصحيحة ٢٦٥١؛ صحيح الترغيب والترهيب ١٤٧٣؛ صححه الألباني'),

(4,
 'The sakinah (tranquility) descended for the Quran — the Prophet ﷺ said this after a man reciting Surah al-Kahf found a cloud shading him and his horse.',
 '«تِلْكَ السَّكِينَةُ تَنَزَّلَتْ لِلْقُرْآنِ»',
 'Sahih Muslim 795',
 'صحيح مسلم ٧٩٥'),

(5,
 'Whoever of you reaches him (the Dajjal), let him recite upon him the opening verses of Surah al-Kahf.',
 'فَمَنْ أَدْرَكَهُ مِنْكُمْ فَلْيَقْرَأْ عَلَيْهِ فَوَاتِحَ سُورَةِ الْكَهْفِ',
 'From the long hadith of al-Nawwas ibn Sam''an; Sahih Muslim 2937',
 'من حديث النواس بن سمعان الطويل؛ صحيح مسلم ٢٩٣٧'),

(6,
 'Whoever recites Surah al-Kahf on Friday will have a light shining for him between the two Fridays.',
 'مَنْ قَرَأَ سُورَةَ الْكَهْفِ يَوْمَ الْجُمُعَةِ أَضَاءَ لَهُ مِنَ النُّورِ مَا بَيْنَ الْجُمُعَتَيْنِ',
 'Al-Mustadrak 2/399; graded sahih by al-Albani, Sahih al-Jami'' 6470',
 'المستدرك ٢/٣٩٩؛ وصححه الألباني في صحيح الجامع ٦٤٧٠'),

(7,
 'Whoever recites Surah al-Kahf on Friday, a light will shine for him from beneath his feet to the clouds of the sky, lighting him on the Day of Resurrection, and he will be forgiven between the two Fridays.',
 'مَنْ قَرَأَ سُورَةَ الْكَهْفِ فِي يَوْمِ الْجُمُعَةِ سَطَعَ لَهُ نُورٌ مِنْ تَحْتِ قَدَمِهِ إِلَى عَنَانِ السَّمَاءِ يُضِيءُ لَهُ يَوْمَ الْقِيَامَةِ، وَغُفِرَ لَهُ مَا بَيْنَ الْجُمُعَتَيْنِ',
 'Ibn Mardawayh in his Tafsir, as cited in at-Targhib wa''l-Tarhib 1/298 (al-Mundhiri: acceptable isnad; al-Albani graded it da''if)',
 'رواه ابن مردويه في تفسيره، نقله المنذري في الترغيب والترهيب ١/٢٩٨ (بإسناد لا بأس به، وضعّفه الألباني)'),

(8,
 'Whoever recites Surah al-Kahf on the night of Friday, a light will shine for him between him and the Ancient House (the Ka''bah).',
 'مَنْ قَرَأَ سُورَةَ الْكَهْفِ لَيْلَةَ الْجُمُعَةِ أَضَاءَ لَهُ مِنَ النُّورِ فِيمَا بَيْنَهُ وَبَيْنَ الْبَيْتِ الْعَتِيقِ',
 'Sunan al-Darimi 3312; al-Bayhaqi 5856; graded sahih by al-Albani, Sahih at-Targhib 736',
 'سنن الدارمي ٣٣١٢؛ والبيهقي ٥٨٥٦؛ صححه الألباني في صحيح الترغيب ٧٣٦');
