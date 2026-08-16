-- Hadith seed data — virtues of Surah al-Kahf.
--
-- All entries are authentic (sahih or hasan) narrations from recognized
-- collections (Sahih Muslim, Sahih al-Bukhari, Sunan Abi Dawud, al-Mustadrak,
-- Sunan al-Darimi) with gradings as noted in the source fields.
--
-- ⚠️ Before production deployment, please have these texts re-verified by a
-- qualified source — accuracy of the Arabic matn and translations matters.
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
 'Narrated by Abu Darda'' (may Allah be pleased with him); Sahih Muslim 809',
 'رواه أبو الدرداء رضي الله عنه؛ صحيح مسلم ٨٠٩'),

(2,
 'Whoever memorizes ten verses from the beginning of Surah al-Kahf will be protected from the trial of the Dajjal.',
 'مَنْ حَفِظَ عَشْرَ آيَاتٍ مِنْ أَوَّلِ سُورَةِ الْكَهْفِ عُصِمَ مِنْ فِتْنَةِ الدَّجَّالِ',
 'Sunan Abi Dawud 4323; graded sahih by al-Albani',
 'سنن أبي داود ٤٣٢٣؛ وصححه الألباني'),

(3,
 'Whoever recites Surah al-Kahf as it was revealed, it will be a light for him on the Day of Resurrection from his place to Makkah.',
 'مَنْ قَرَأَ سُورَةَ الْكَهْفِ كَمَا أُنْزِلَتْ كَانَتْ لَهُ نُورًا يَوْمَ الْقِيَامَةِ مِنْ مَقَامِهِ إِلَى مَكَّةَ',
 'Sunan Abi Dawud 4324; graded sahih by al-Albani',
 'سنن أبي داود ٤٣٢٤؛ وصححه الألباني'),

(4,
 'The sakinah (tranquility) descended for the Quran — the Prophet ﷺ said this after a man reciting Surah al-Kahf found a cloud shading him and his horse.',
 '«تِلْكَ السَّكِينَةُ تَنَزَّلَتْ لِلْقُرْآنِ»',
 'Sahih al-Bukhari 3614; Sahih Muslim 795',
 'صحيح البخاري ٣٦١٤؛ صحيح مسلم ٧٩٥'),

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
 'Reported by Ibn Mardawayh; graded hasan by al-Mundhiri, at-Targhib wa''l-Tarhib 1/298',
 'رواه ابن مردويه؛ وحسّنه المنذري في الترغيب والترهيب ١/٢٩٨'),

(8,
 'Whoever recites Surah al-Kahf as it was revealed, it will be a light for him on the Day of Resurrection.',
 'مَنْ قَرَأَ سُورَةَ الْكَهْفِ كَمَا أُنْزِلَتْ كَانَتْ لَهُ نُورًا يَوْمَ الْقِيَامَةِ',
 'Al-Mustadrak 2/399; graded sahih by al-Albani, Sahih al-Jami'' 6471',
 'المستدرك ٢/٣٩٩؛ وصححه الألباني في صحيح الجامع ٦٤٧١'),

(9,
 'Whoever recites Surah al-Kahf on the night of Friday, a light will shine for him between him and the Ancient House (the Ka''bah).',
 'مَنْ قَرَأَ سُورَةَ الْكَهْفِ لَيْلَةَ الْجُمُعَةِ أَضَاءَ لَهُ مِنَ النُّورِ فِيمَا بَيْنَهُ وَبَيْنَ الْبَيْتِ الْعَتِيقِ',
 'Sunan al-Darimi 3273; graded sahih by al-Albani, Sahih al-Targhib 736',
 'سنن الدارمي ٣٢٧٣؛ وصححه الألباني في صحيح الترغيب ٧٣٦');
