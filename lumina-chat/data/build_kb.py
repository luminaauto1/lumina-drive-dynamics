# -*- coding: utf-8 -*-
"""
build_kb.py  —  Single source of truth for the Lumina Auto standalone chat responder.

Run:  python3 build_kb.py
Emits:
  - knowledge_base.json     (machine-readable KB: quick replies, templates, funnel, intents, rules)
  - ../db/seed.sql          (Supabase INSERTs generated from the same data)

All content below was mined read-only from 1,430 already-read EasySocial conversations
(business_id 4026, "Lumina Auto"). Nothing was sent; no unread chat was opened.
"""
import json, re, os

# =============================================================================
# 1) QUICK REPLIES  — the 33 saved canned answers pulled from EasySocial
#    (GET https://api.easysocial.in/api/v1/quick-reply). These are the agent's
#    real words. keyword = the "/shortcut" typed in EasySocial's composer.
# =============================================================================
QUICK_REPLIES = [
{"keyword":"accountnumber","message":"""We ask for your bank account number because 3 of the 5 major banks we work with require it to process an application.

*You do not have to provide it:* However, leaving it out means we can only submit your application to 2 banks, which greatly lowers your chances of success.

Providing your details allows us to approach all the banks on your behalf to give you the best possible result. \U0001F4C8"""},

{"keyword":"Nolicencerespond","message":"""Here are ways to buy a car without a licence, unfortunately a Learner's Licence won't work \U0001F697

\U0001F538When buying cash you don't need a licence
\U0001F538Nominated driver, Has to be a parent has to live in same household and have same proof of address
\U0001F538If you have a medical disability and then a nominated river (Need a Medical Certificate)
\U0001F538Your Partner Licence and have to be married in Community of Property

Video on this:
https://www.tiktok.com/@zinantalksvw/video/7214415606978710790

What will be the best way for you ?"""},

{"keyword":"Nominated driver check","message":"""Ok great! but *VERY IMPORTANT*

➡️Is the person your *biological mother / father?*

➡️Or if it is your spouse, *are you married in community of property* and do they have a licence?

➡️Do you and your nominated driver have the same proof of address"""},

{"keyword":"questions morning","message":"""Good morning! Thanks for reaching out. How can I assist you today?"""},

{"keyword":"nominated driver","message":"""Here are the things that need to be in place with a nominated driver

➡️Is the person your *biological mother / father?*

➡️Or if it is your spouse, *are you married in community of property* and do they have a licence?

➡️Do you and your nominated driver have the same proof of address"""},

{"keyword":"decline","message":"""Hey! I received the bank's response. While we can't get an approval today, the good news is that we should get it approved in the next 2-3 months! With a little work on your credit score, you'll be ready in a few short months.

Here is exactly what you need to do (and avoid) to get approved next time:
To-Do List:
\U0001F539 Settle any accounts in arrears.
\U0001F539 Build a new, consistent paying profile over the next 3-6 months. (Keep in mind: cell contracts, Wi-Fi, and memberships don't count towards building credit). \U0001F4F1

What to Avoid:
❌ No new personal loans.
❌ No micro loans or payday loans.
❌ Do not apply for vehicle finance anywhere else for now.

Sign up for ClearScore online. It’s 100% free and it will send you a monthly report to show how your score is improving! \U0001F4C8

I’m definitely keeping your number saved. Please save mine, trust the process, and ask me any questions you might have along the way! \U0001F91D

\U0001F4CCI also offer R5000 for every person you refer to me who buys a vehicle! \U0001F4B0"""},

{"keyword":"referral","message":"""Thank you for your interest in our referral program! \U0001F91D

We offer a *R5000* cash reward to YOU for every successful referral you send our way.

*How it works:*
- Visit our website: \U0001F310 *luminaauto.co.za*
- Click on the *Money Maker* button.
- Submit the contact details of the person looking to buy a vehicle.
- Once your referral successfully purchases and takes delivery of a car from us, we pay you R5000! \U0001F4B0

There is no limit to how many people you can refer. Let me know if you have someone in mind!"""},

{"keyword":"installments","message":"""Installments vary from client to client as each person is scored differently by the bank according to their own personal profile.

Installments could be lower or higher but you are looking between R3800pm- R5000pm"""},

{"keyword":"badcredit","message":"""Here is some general advice that I hope will help you get back on track! :)

Unfortunately, banks cannot approve vehicle finance while your credit profile shows missed payments or accounts in arrears. ⛔

Please Note: Banks need to see a consistent track record of on-time payments before approving a loan. Every missed payment lowers your score, and applying for new credit right now will hurt your profile further.

The good news is that this is completely fixable! Once you bring your accounts up to date, we can start working towards your new vehicle. Here is how you can rebuild:

✅ First step: Catch up on all missed payments and bring your accounts completely up to date.

✅ You will need to maintain a clean, on-time payment record for 3 to 6 months before applying.

✅ A 610 credit score (www.clearscore.co.za) is favorable for vehicle finance, although banks look at other factors too.

✅ Use less than 50% of your available credit. For example, if you have a credit limit of R10k on a store account, only use up to R5k.

✅ Always pay more than the minimum. If your monthly premium is R200, pay R250.

✅ Cellphone, gym, internet contracts, and life policies do not build credibility for vehicle finance.

❌ IMPORTANT: Do not make any new credit applications, as this will drop your score further.

In the meantime, I am saving your number! I always post helpful advice and great vehicle specials on my Status. \U0001F64F

Please save mine to view them, and remember: I offer a R5000 referral fee directly to YOU for each successful referral you send our way! \U0001F91D"""},

{"keyword":"blacklisted","message":"""Here is some general advice that I hope will help you on your journey! :)

Unfortunately, banks cannot legally approve any new vehicle finance while a profile is actively under debt review. ⛔

Please Note: Nobody can remove debt review from your profile unless all accounts are fully settled. Stay away from scams, and please do not apply for any new credit right now, as it will hurt your profile further.

The good news is that once you complete the process and receive your Clearance Certificate, we can apply for your vehicle! Here is how you can prepare for that day:

✅ Once accounts and arrears are settled, you are basically starting your credit record fresh again.

✅ You will need to build a new paying credit profile from 3 to 6 months.

✅ A 610 credit score (www.clearscore.co.za) is favorable for vehicle finance, although banks look at other factors too.

✅ Use less than 50% of your available credit. For example, if you have a credit limit of R10k on a store account, only use up to R5k.

✅ Always pay more than the minimum. If your monthly premium is R200, pay R250.

✅ Cellphone, gym, internet contracts, and life policies do not build credibility for vehicle finance.

❌ IMPORTANT: Do not make any credit applications, as this may negatively affect you.

In the meantime, I am saving your number! I always post helpful advice and great vehicle specials on my Status. \U0001F64F

Please save mine to view them, and remember: I offer a R5000 referral fee directly to YOU for each successful referral you send our way! \U0001F91D"""},

{"keyword":"6month","message":"""Do you have 6 months of bank statements that consistently reflects that income?"""},

{"keyword":"docs","message":"""Thank you for taking my call!\U0001F601

The banks need the following documents:

\U0001F505ID
\U0001F505License
\U0001F505Latest 3 payslips
\U0001F5053 month bankstatements

You can email us or Whatsapp me *CLEAR* pictures
( finance@luminaauto.co.za )"""},

{"keyword":"nocredit","message":"""Because you currently have no active credit facilities (such as a credit card or retail account), banks cannot generate a credit score or assess your repayment history. Consequently, they will not approve vehicle finance at this stage.

Required Next Steps:
1️⃣Open a minor credit facility to establish a profile.
2️⃣Maintain a perfect payment record for 3 to 6 months.
3️⃣Contact us once your credit score is active.

\U0001F534*Note:* Cellphone & network accounts does not affect credit score.

We look forward to assisting you with your vehicle purchase once your credit profile is established."""},

{"keyword":"debtreview","message":"""Unfortunately, banks cannot legally approve any new vehicle finance while a profile is actively under debt review. ⛔

*Next Steps*
* You will need to successfully complete your debt review process.
* Once completed, you will be issued a *Clearance Certificate*.
* As soon as you have that certificate, we can apply for vehicle finance!

*Save my number* for when you are ready, or if you need any advice in the future. \U0001F91D

*Remember:* We offer *R5000* referral to *YOU* for every successful referral you send us!

PLEASE NOTE: *NOBODY can remove debt review from your profile unless all accounts has been settled FULLY. And NO official finance/loans can be given to you while under debt review! Stay away from scams and do not continue applying, because it hurts your credit profile even more!!*"""},

{"keyword":"deposit","message":"""*We don't and never will ask any money upfront*, we are very open and we always work around a deposit to avoid it with the bank \U0001F3E6

➡️ BUT if you want you can add a deposit to make your installment less. This can be done anytime during your finance of the car and doesn't have to be done before buying a car.

Every *R10000* makes your monthly installment less by *R200pm*"""},

{"keyword":"spouse","message":"""Banks need the following info please:

* Spouse Name and Surname
* Spouse ID number
* Spouse contact number
* Date Married"""},

{"keyword":"winning","message":"""Hi there! Are you *winning* with the *information?* \U0001F64C\U0001F3FD Let me know if you need any assistance."""},

{"keyword":"arrears","message":"""Do you have accounts in arrears or are you under debt review?"""},

{"keyword":"whyscore","message":"""Why is your credit score low?"""},

{"keyword":"catalog","message":"""We work with all types of vehicles *new, used, and demos!* \U0001F3CE️

When it comes to vehicle finance, the banks look at a lot of different factors. They score cars differently, and they also score each person uniquely based on their personal credit profile.

*Here is what makes us different:* We fight for you with the banks! \U0001F94A We guide you through the whole process and explore every option to see which car gets you the best approval. Once we have that sorted, we present you with a variety of new, used, or demo options to make sure we find the absolute perfect match for you. ✨

You can check out some of our current stock here:
\U0001F697 https://luminaauto.co.za/inventory

But remember, if you don't see what you want, we can source it for you. Let me know what you have in mind and we can get started! \U0001F91D"""},

{"keyword":"future","message":"""I’ve got your number saved! ✅ Save mine as well so we stay in touch. Don't stress at all, we will get you into a car, *let’s just check back in 2-3 months. ⏳\U0001F699*

For now, please avoid putting in any more applications anywhere else. Just trust the process! When you check in with us later, *we will just refresh your profile to see the new updates.* We are fully committed to helping you! \U0001F973\U0001F64C"""},

{"keyword":"low income","message":"""To qualify for vehicle finance, you do need *a minimum net take-home pay of R8500 p/m, or R20000 if you are self-employed.* I know you'll reach those goals soon, and I'll be right here ready to help you get your dream car when you do! \U0001F698✨

\U0001F4E2\U0001F4E2 I'm saving your details on my side. Definitely If you know anyone looking for a car, *I offer a R1000 - R10,000 spotter’s fee for every successful referral!* \U0001F4B8\U0001F525"""},

{"keyword":"no licence","message":"""That is 100% okay! *Focus on getting that license, and I will be waiting to hand over the keys to your new car when you're ready!* \U0001F973\U0001F511

I've got your number saved for when the time comes. Feel free to message me anytime if you have any questions! \U0001F4F1

Make sure to save my number as well to see my newest stock and specials on my WhatsApp statuses. \U0001F929

‼️ Also, don't forget! I give a R1000 - R5000 cash bonus for every person you refer who purchases a vehicle from me! \U0001F4B0\U0001F525"""},

{"keyword":"Based","message":"""We are based in Pretoria and *we deliver nationwide free of charge!* \U0001F30E

Where ever you are we are \U0001F697"""},

{"keyword":"options","message":"""We work on new, used and demo \U0001F3CE. When we do vehicle finance there is a lot of factors to take in mind with the bank and how they score cars, they also score each person differently based on their personal profile.

What makes us different is we fight with the bank, we help and guide our clients and work through all the different options to see which car they qualify for the best with the bank. After that, we present all the different options for you based on new, used and demos and make sure we get the perfect one for you"""},

{"keyword":"creditscore","message":"""When purchasing a car via finance it is not so much about the credit score but more based on your personal profile ✅

Stuff that also boosts chances of approval is stuff like your education history, workplace, work position, current time at employer age, etc. Banks are also eager to help first-time car buyers and if they have had a car in the past.

Another example is if you are behind on any payments, what is your credit history, how long have you been paying credit, how much percentage of your credit do you use, etc

So as you can see your credit score doesn't really have such an impact on your car finance, that is where we go the extra mile and build you a strong profile, all of our clients have a fair chance of approval!

With us, you don't just apply we also walk the road with you to make sure you do get approved! That is what makes us the best in the industry ❤"""},

{"keyword":"trade in","message":"""How a trade in works

- we need to see what your settlement amount is (what you owe the bank now) vs what your car is worth

- if your settlement is higher than the car is worth you will have a shortfall, the shortfall you either need to settle it cash or we need if possible to load ontop of the new deal. Every R10k we load will make the instalment go up by R200

- if your car is worth more than your settlement you can either take the extra capital as a refund or you can put it down as a deposit on the new deal

•••••••••••••••••••••••••••••

Please send me the below details of your trade in

\U0001F697 amount you owe
\U0001F3E6 with who did you finace
\U0001F3CE make
\U0001F3CE model
\U0001F3CE year
\U0001F3CE engine (1.4 etc)
\U0001F3CE transmission (man or auto)
\U0001F3CE kms
Any extras we should know of like sunroof etc"""},

{"keyword":"preapprove1","message":"""Hi\U0001F44B

I am following-up regarding your vehicle application.

We are ready to move forward to the next steps, but we just need your supporting documents to finalize the bank's validation process. \U0001F4C4

Please let me know if you need any assistance gathering them, or when we can expect to receive them."""},

{"keyword":"preapprove2","message":"""Hi\U0001F44B

I have been trying to reach you via WhatsApp and phone calls to finalize your vehicle application, but I haven't been able to get through. \U0001F4F1

The bank requires your supporting documents to keep your file active and proceed with the validation.

Is there an alternative number where I can reach you, or a better time to call? Please let me know how you would like to proceed so we can avoid any delays on your profile. ⏳"""},

{"keyword":"preapprove3","message":"""Hi ! I trust you are doing well

I have been trying to get hold of you on whatsapp and through calls but haven't been getting through to you?

Is there something we did wrong or you would like us to approve? What do you want me to do for you to take the next steps \U0001FAF6\U0001F3FD

*I don't want your credit profile to be affected in a negative way because of the pending application which is reflecting on your name which can result in a negative way on any future enquires even blocking you ❌*

Please respond to this message for us to assist you and also to help us prevent any negative affect to your profile \U0001FAF6"""},

{"keyword":"preapprove4","message":"""VERY IMPORTANT UPDATED REGARDING YOUR CREDIT PROFILE
Hey {{1}} \U0001F64B\U0001F3FE‍♂️ the status of your profile is getting very serous and stands a risk ‼️

⚠️ I have been trying to get hold of you on WhatsApp and through calls but haven't been getting through to you and we must update the bank on the status of your profile to prevent it from being handed over

Is there something we did wrong or you would like us to approve? Rather discuss with me, then I can assist not responding is only making it worse

I don't want your credit profile to be affected in a negative way because of the pending application which is reflecting on your name which can result in a negative way on any future enquires even blocking you ❌"""},

{"keyword":"badcredit1","message":"""Hi\U0001F44B

I am following-up regarding your vehicle application.

We are ready to move forward to the next steps, but we just need your supporting documents to finalize the bank's validation process. \U0001F4C4

Please let me know if you need any assistance gathering them, or when we can expect to receive them."""},

{"keyword":"badcredit2","message":"""Hi\U0001F44B

I have been trying to reach you via WhatsApp and phone calls to finalize your vehicle application, but I haven't been able to get through. \U0001F4F1

The bank requires your supporting documents to keep your file active and proceed with the validation.

Is there an alternative number where I can reach you, or a better time to call? Please let me know how you would like to proceed so we can avoid any delays on your profile. ⏳"""},
]

# =============================================================================
# 2) WHATSAPP TEMPLATES — the 17 approved templates (used to (re)open chats and
#    for the >24h window where free text is not allowed). id = EasySocial wa id.
# =============================================================================
TEMPLATES = [
{"id":30732,"name":"tiktok_intro","category":"opener","usage":636,"buttons":["Let's get the ball rolling!"],
 "body":"""Hey {{name}}! \U0001F601\n\nI'm *Albert from Lumina Auto* \U0001F3CE️\n\n*I saw you just filled out a form on TikTok and I wanted to reach out personally to assist you* \U0001F57A\n\nWhether you’re looking for a *brand-new ride or a quality demo/used car,* I’m here to handle the heavy lifting, especially when it comes to securing the best financing for you! \U0001F4B3\n\nYou can just respond to this message then we can check exactly what we can get for you \U0001F697"""},
{"id":30743,"name":"excited_qualify_5min","category":"opener","usage":580,"buttons":["Let's make it happen!","Not interested"],
 "body":"""Hey {{name}}! \U0001F929\U0001F697\n\nI am very excited to get you the deal of a lifetime on your new dream car! \U0001F389\n\n*Would you like to see how you qualify, it only takes 5minutes*. ✅\n\n*NO DOCUMENTS NEEDED*"""},
{"id":30748,"name":"no_reply_reminder","category":"reminder","usage":462,"buttons":["Sorry I just got busy","Give me the best deal eva!!","I won't qualify for car finance","Not interested"],
 "body":"""Hey {{name}} I see you haven't gotten back to me \U0001F494 I offer the best deals in SA and go out of my way for my customers! \U0001F1FF\U0001F1E6\n\nI strive to bring excellent service to my clients \U0001F389\n\nWith that being said please keep in mind we are on of the biggest motor groups in South-Africa! *Which mean we sell all brands \U0001F697\nAnything from VW, Suzuki, Renault, Hyundai, BMW, Ford and the list goes on* \U0001F4A5\n\nIs there anything unclear or uncertain in which I communicated with you ?"""},
{"id":30733,"name":"sorry_couldnt_assist_referral","category":"closer","usage":290,"buttons":[],
 "body":"""Sorry I couldn't assist to make your dream come true \U0001F494\n\nIm saving your number, save mine to see updates on specials, tips and the latest releases on my status\n\n*I offer R5000 per Client that you refer to me that successfully buys a vehicle* \U0001F4B0\U0001F4B0\U0001F4B0\n\nImagine giving me 2-4 clients a month \U0001F60A"""},
{"id":30749,"name":"application_submitted","category":"status","usage":134,"buttons":[],
 "body":"""Hi {{name}}! This whatsapp is to confirm that your application has been submitted to the banks.\nWe are currently awaiting their response and will provide you with an update as soon as it becomes available.\n\nYou can also send the following to speed up the process\U0001F3C1\n\n\U0001F505ID\n\U0001F505License\n\U0001F5053 Months Bankstatements\n\U0001F505Latest Payslip\n\n*If already sent, please ignore*"""},
{"id":30746,"name":"declined_advice","category":"status","usage":45,"buttons":[],
 "body":"""Hey {{name}}! I received the bank's response. While we can't get an approval today, the good news is that we should get it approved in the next 2-3 months! With a little work on your credit score, you'll be ready in a few short months.\n\nHere is exactly what you need to do (and avoid) to get approved next time:\nTo-Do List:\n\U0001F539 Settle any accounts in arrears.\n\U0001F539 Build a new, consistent paying profile over the next 3-6 months. (Keep in mind: cell contracts, Wi-Fi, and memberships don't count towards building credit). \U0001F4F1\n\nWhat to Avoid:\n❌ No new personal loans.\n❌ No micro loans or payday loans.\n❌ Do not apply for vehicle finance anywhere else for now.\n\nSign up for ClearScore online. It’s 100% free and it will send you a monthly report to show how your score is improving! \U0001F4C8\n\nI’m definitely keeping your number saved. Please save mine, trust the process, and ask me any questions you might have along the way! \U0001F91D\n\n\U0001F4CCI also offer R5000 for every person you refer to me who buys a vehicle! \U0001F4B0"""},
{"id":30745,"name":"press_hi_button","category":"reengage","usage":10,"buttons":[],
 "body":"""Hey {{name}}! Please respond or press the "Hi" button to this message to allow me to send you further information \U0001F447"""},
{"id":30883,"name":"finance_preapproved","category":"status","usage":8,"buttons":[],
 "body":"""\U0001F534FINANCE UPDATE: PRE-APPROVED\U0001F534\n\n\U0001F464 Client Details:\n\n{{name}}\n\n{{phone}}\n\nContact to finalize!"""},
{"id":30738,"name":"debt_review_advice_tmpl","category":"advice","usage":7,"buttons":[],
 "body":"""Unfortunately, banks cannot legally approve new vehicle finance while under debt review. ⛔\n\nNobody can remove debt review unless all accounts are fully settled. Avoid scams, and do not apply for new credit, as it damages your profile.\n\nOnce you receive your Clearance Certificate, we can apply! How to prepare:\n✅ Settle accounts to start your credit fresh.\n✅ Build a paying credit profile for 3 to 6 months.\n✅ Aim for a 610 credit score (ClearScore).\n✅ Keep credit utilization under 50% (e.g., R5k on a R10k limit).\n✅ Always pay more than the minimum installment.\n✅ Cellphone and gym contracts do not build vehicle credibility.\n❌ IMPORTANT: Do not make any credit applications.\n\nI am saving your number to share helpful advice and vehicle specials on my Status. \U0001F64F\n\nPlease save mine. Remember: Lumina Auto offers a R5000 referral fee directly to YOU for each successful referral! \U0001F91D"""},
{"id":31765,"name":"looking_to_finance","category":"opener","usage":14,"buttons":[],
 "body":"""Hey Are you looking to finance a car?, Albert from Lumina Auto \U0001F4AA"""},
{"id":31766,"name":"good_morning_assist","category":"opener","usage":3,"buttons":[],
 "body":"""Good morning! Thanks for reaching out. How can I assist you today?"""},
{"id":31211,"name":"based_delivery","category":"info","usage":1,"buttons":[],
 "body":"""We are based in Pretoria and *we deliver nationwide free of charge!* \U0001F30E\n\nWherever you are, we are \U0001F697"""},
{"id":31199,"name":"system_offline","category":"ops","usage":1,"buttons":[],
 "body":"""Hi {{name}}! \U0001F44B\n\nAlbert here from Lumina Auto.\n\nI am reaching out with a quick update regarding your vehicle finance application. Our system connection to the banking portals is currently offline\U0001F3E6, meaning we are temporarily unable to submit new applications or receive feedback on pending ones.❌\n\nThe system will be fully back online next week Wednesday.\U0001F5D3️\n\nIf you are happy to wait, we will prioritize your application the moment connectivity is restored. However, if you prefer to look at alternative options in the meantime, please let me know.\U0001F4F2\n\nThank you for your patience and understanding.\n\nRegards,\nAlbert\nLumina Auto"""},
{"id":31320,"name":"system_back_online","category":"ops","usage":1,"buttons":["Let's Submit!","Applied Elsewhere","Cancel"],
 "body":"""Hey {{name}}! \U0001F44B\n\nAlbert here from Lumina Auto.\n\n*Good news!* Our system link to the banks should officially be *back online* today! \U0001F3E6✨\n\nBefore we push forward, I just wanted to check if you’ve already applied anywhere else while we were offline, or if *you'd like us to go ahead and submit your application here?* Alternatively, let me know if you'd prefer to cancel it for now. \U0001F4F2\n\nLooking forward to your update so we can *get things moving for you.*\n\nBest regards,\nAlbert\n\n*Lumina Auto*"""},
{"id":30789,"name":"pausing_file","category":"closer","usage":1,"buttons":[],
 "body":"""Hey {{name}}! Albert here from Lumina Auto! \U0001F44B\n\nI am currently updating my records and will be pausing your vehicle file for now. We understand that plans change and timing isn't always perfect, that is completely okay! Sorry I couldn't make your dream come true now, but we will be doing it in the near future \U0001F389\n\nWhenever you are ready to get your dream vehicle, simply reach out and we will pick up right where we left off we sell all brands, new used and demo \U0001F698\n\n❗ A quick tip: Keep your credit profile healthy by avoiding any unnecessary credit applications in the meantime. \U0001F4C8\n\nRemember: We offer a R5000 referral to YOU for every successful referral you send us! \U0001F911"""},
{"id":30832,"name":"referral_intro","category":"opener","usage":1,"buttons":[],
 "body":"""Hi {{name}}! \U0001F44B\n\nI’m Albert from Lumina Auto.\n\nI was recently given your details by a mutual contact who mentioned you might be looking for a new vehicle. I help my clients source, finance, and deliver quality cars that perfectly match their needs and budget. \U0001F697\n\nI would love to see if I can assist you in finding your next car."""},
{"id":30735,"name":"finance_preapproved_2","category":"status","usage":2,"buttons":[],
 "body":"""FINANCE UPDATE: PRE-APPROVED\n\n\U0001F464 Client Details:\n\n{{name}}\n\n{{phone}}\n\nContact to finalize!"""},
]

# =============================================================================
# 3) QUALIFICATION FUNNEL — the interactive menu decision tree the bot walks
#    every new lead through (mined from 1,430 chats). code is our internal id.
#    next maps each option -> the next node code (or an action).
# =============================================================================
FUNNEL = [
{"code":"start","question":"How can I assist you today \U0001F60A\n\nYou can select any of the options below \U0001F447",
 "options":[
   {"title":"I want my dream car now!","next":"licence"},
   {"title":"Check If I Qualify","next":"licence"},
   {"title":"I've Got Questions","next":"qr:questions morning"}]},
{"code":"licence","question":"Great! Here are 3 quick Questions so we can see how you qaulify \U0001F3CE\n\nDo you have a drivers Licence ?",
 "options":[
   {"title":"Yes I Do","next":"credit","set":{"licence":"yes"}},
   {"title":"No Licence Yet","next":"qr:no licence","set":{"licence":"no"}},
   {"title":"I Only Have Learners","next":"learners_reply","set":{"licence":"learners"}}]},
{"code":"credit","question":"Thanks {{name}}! Things are looking good!\n\nWe fight for every client, no matter your credit profile. We’ll help you understand the process and what’s needed and make your dream a reality! \U0001F3CE✅\n\nHow's your credit profile looking?",
 "options":[
   {"title":"Good Credit Record","next":"timeline","set":{"credit":"good"}},
   {"title":"Its looking better","next":"timeline","set":{"credit":"improving"}},
   {"title":"Im not sure","next":"qr:arrears","set":{"credit":"unsure"}},
   {"title":"Blacklisted/Debt Review","next":"qr:debtreview","set":{"credit":"debt_review"}},
   {"title":"Missed Many Payments","next":"missed_payments","set":{"credit":"missed"}},
   {"title":"No Credit Record","next":"qr:nocredit","set":{"credit":"none"}}]},
{"code":"timeline","question":"To get you the best deal ever we just need to answer a few quick questions \U0001F91D\n\n\U0001F7E2 If you are happy and all is good WHEN are you looking to buy then?",
 "options":[
   {"title":"As Soon As Possible","next":"income","set":{"timeline":"asap"}},
   {"title":"Within A Month","next":"income","set":{"timeline":"month"}},
   {"title":"Need to sort stuff","next":"need_sort","set":{"timeline":"later"}}]},
{"code":"income","question":"Let's GOOO! \U0001F525\n\nAre you permanently employed and earn a net salary on your payslip of R8500 or more per month?\n\n(Self Employed must earn a minimum per month)",
 "options":[
   {"title":"Yes sir!","next":"qr:docs","set":{"income":"yes"}},
   {"title":"Not yet","next":"qr:low income","set":{"income":"no"}},
   {"title":"It's Complicated","next":"ESCALATE","set":{"income":"complicated"}}]},
{"code":"missed_payments","question":"Thats not bad news at all! As long as you are not behind on any payments or missed payments we will be able to assist!\n\nThats what makes us different! We fight for each one of our clients!\n\nWhich of the options fits you best??",
 "options":[
   {"title":"Let's do it!","next":"timeline"},
   {"title":"Let me explain first","next":"ESCALATE"},
   {"title":"3+ Missed Payemnts","next":"qr:badcredit"}]},
{"code":"learners_reply","question":"Thanks {{name}} Here are ways to buy a car, unfortunately a Learner's Licence won't work \U0001F697",
 "options":[
   {"title":"Nominated Driver","next":"nominated_driver"},
   {"title":"Medical Reason","next":"ESCALATE"},
   {"title":"Will Get Licence","next":"qr:no licence"}]},
{"code":"nominated_driver","question":"Ok great! but *VERY IMPORTANT*\n\n➡️Is the person your biological parent, or your spouse (married in community of property) with a licence, and do you share the same proof of address?",
 "options":[
   {"title":"Yes - My Parents","next":"credit"},
   {"title":"Yes - My Partner","next":"credit"},
   {"title":"None of these","next":"qr:Nolicencerespond"}]},
{"code":"need_sort","question":"{{name}}, we provide solutions for each person needs. Your 1st instalment will not be now. Car prices only go up never down.",
 "options":[
   {"title":"Im happy with that!","next":"income"},
   {"title":"Does not help me","next":"ESCALATE"},
   {"title":"Let me explain first","next":"ESCALATE"}]},
]

# =============================================================================
# 4) INTENTS — free-text client message -> which quick reply / action.
#    patterns are lowercase regex fragments (OR-ed). Evaluated top-down;
#    first match wins. action: 'qr'=send quick reply, 'template', 'funnel',
#    'escalate'. min_hits: how many distinct pattern groups must match (1 default).
# =============================================================================
INTENTS = [
 {"name":"location","priority":20,"action":"qr","target":"Based",
  "patterns":[r"where.{0,15}(you|u|your office|guys).{0,15}(base|located|situated|office)", r"\bwhere are (you|u|your)\b", r"\bwhere.{0,10}(based|located)\b", r"\blocation\b", r"which (city|town|area)", r"branch in", r"do you deliver", r"nationwide", r"\bdelivery\b", r"come to (you|your office)"]},
 {"name":"deposit_or_upfront","priority":25,"action":"qr","target":"deposit",
  "patterns":[r"\bdeposit\b", r"up\s?front", r"money (first|before)", r"pay.{0,10}before", r"(afraid|scared|worried|nervous).{0,15}scam", r"scam.{0,15}(afraid|scared|money)", r"money you need to qualify", r"afraid.*money", r"\bballoon\b"]},
 {"name":"installments_price","priority":30,"action":"qr","target":"installments",
  "patterns":[r"install?ments?", r"how much.{0,20}(pay|month|car|cost|instal|deal|finance)", r"\bprice\b", r"repayment", r"per month", r"monthly (install?ment|payment|repay|premium|instal|amount)", r"instal?ment.{0,10}(not more|less than|under|around|about)", r"what.{0,15}instal"]},
 {"name":"documents","priority":35,"action":"qr","target":"docs",
  "patterns":[r"\bdocuments?\b", r"what.{0,15}(need|require).{0,15}(qualify|apply|buy|vehicle|car)", r"requirements?", r"\bpapers?\b", r"what do i need", r"what is needed", r"what.{0,10}(bye|buy).{0,10}(a )?(car|vehicle)"]},
 {"name":"catalog_stock","priority":40,"action":"qr","target":"catalog",
  "patterns":[r"which cars?", r"what cars?", r"\bstock\b", r"inventory", r"list (of|off) cars?", r"show me.{0,15}cars?", r"cars? (do you|available)", r"varieties", r"7\s?seater", r"panel van", r"\bbakkies?\b", r"automatic cars?", r"do you (have|sell|stock|do).{0,25}(car|bakkie|van|suv|sedan|hatch|automatic|manual|vw|toyota|ford|renault|hyundai|suzuki|bmw|polo|triber|ecosport|golf|tigo|cherry|rav4)", r"(triber|ecosport|polo|golf|tigo|rav4|cherry).{0,10}(available|in stock)", r"which (cars?|vehicles?).{0,10}(qualify|get)", r"\bused car\b", r"i like (this|that) car", r"interested in (this|the|a) (car|vehicle)", r"what (are you|do you) (offer|have)", r"give me more info", r"more info on this"]},
 {"name":"credit_score_info","priority":45,"action":"qr","target":"creditscore",
  "patterns":[r"how much credit score", r"what.{0,15}credit score.{0,15}(need|looking|require)", r"minimum credit score", r"what.{0,10}score.{0,10}(need|require|looking)"]},
 {"name":"debt_review","priority":50,"action":"qr","target":"debtreview",
  "patterns":[r"debt\s*review", r"under review", r"debt counsel"]},
 {"name":"blacklisted","priority":55,"action":"qr","target":"blacklisted",
  "patterns":[r"black\s?list", r"\bitc\b", r"judg? e?ment", r"handed over", r"\bred flag\b"]},
 {"name":"bad_credit_arrears","priority":60,"action":"qr","target":"badcredit",
  "patterns":[r"arrears", r"missed.{0,10}payment", r"behind.{0,12}(payment|on|with)", r"bad credit", r"(low|bad|poor|not good|not that good|not great|bit damage|damaged|messed).{0,12}credit", r"credit.{0,14}(is )?(bad|low|poor|not good|isn.?t good|not that good|not great|damage|messed|ruined|bit damage|not so)", r"defaulted?", r"(score|credit).{0,12}(is )?[3-6]\d\d\b", r"[3-6]\d\d\b.{0,12}(score|credit)"]},
 {"name":"no_credit","priority":65,"action":"qr","target":"nocredit",
  "patterns":[r"no credit (record|history|profile|score)", r"never (had|took|used).{0,10}credit", r"don'?t have (any )?credit", r"no active credit"]},
 {"name":"nominated_driver","priority":71,"action":"qr","target":"nominated driver",
  "patterns":[r"nominated driver", r"nominee", r"someone else.{0,12}(licen|drive)", r"my (mother|father|parent|mom|dad|husband|wife|partner|spouse|brother|sister|son|daughter|cousin|uncle|aunt|in.?law|family).{0,20}(licen|drive)"]},
 {"name":"no_licence","priority":72,"action":"qr","target":"no licence",
  "patterns":[r"(\bno\b|don'?t have|do not have|without|haven'?t got|no valid|dont have).{0,15}(licen|license)", r"(licen|license).{0,12}(no|not yet|expired|dont|don'?t have)", r"don'?t.{0,6}(have a )?licen"]},
 {"name":"licence_question","priority":73,"action":"qr","target":"Nolicencerespond",
  "patterns":[r"(must|need|require|necessary|have to|is it a must|do i need).{0,20}(licen|license)", r"(licen|license).{0,15}(must|required|necessary|need)"]},
 {"name":"learners_only","priority":74,"action":"qr","target":"Nolicencerespond",
  "patterns":[r"learner'?s?( licence| license| licens)?", r"only.{0,10}learner", r"busy.{0,10}(with )?(my )?learner"]},
 {"name":"spouse_info","priority":76,"action":"qr","target":"spouse",
  "patterns":[r"married in com", r"community of property", r"\bspouse\b", r"my (husband|wife).{0,12}licen"]},
 {"name":"low_income","priority":78,"action":"qr","target":"low income",
  "patterns":[r"earn.{0,10}[rR]?\s?[1-7][ ,.]?\d{3}\b", r"salary.{0,12}(of )?[rR]?\s?[1-7][ ,.]?\d{3}\b", r"[1-7][ ,.]?\d{3}\b.{0,15}(salary|earn|month|pm|net|take.?home|per month)", r"salary.{0,10}(is )?(low|too low|small)", r"don'?t (earn|make) enough", r"below.{0,10}(8500|8 500)", r"less than.{0,10}8500", r"(monthly )?salary of [1-7]"]},
 {"name":"referral","priority":80,"action":"qr","target":"referral",
  "patterns":[r"refer(r?al)?", r"money maker", r"spotter", r"commission.{0,10}refer", r"how does the refer"]},
 {"name":"trade_in","priority":82,"action":"qr","target":"trade in",
  "patterns":[r"trade.?in", r"trade my", r"settlement", r"my (current )?car.{0,15}(swap|trade|exchange)", r"exchange my car"]},
 {"name":"self_employed","priority":84,"action":"qr","target":"6month",
  "patterns":[r"self.?employ", r"own business", r"no payslip", r"don'?t have.{0,10}payslip", r"i'?m a business", r"business owner", r"we don'?t get payslip"]},
 {"name":"account_number","priority":86,"action":"qr","target":"accountnumber",
  "patterns":[r"why.{0,15}(bank )?account number", r"account number.{0,12}(why|need|safe|for)"]},
 {"name":"interested_finance","priority":90,"action":"funnel","target":"start",
  "patterns":[r"(want|need|looking for|interested|get).{0,15}(car|vehicle|bakkie|finance)", r"do you (do|offer|have).{0,10}finance", r"finance a (car|vehicle)", r"i (want|need) a car", r"check if i qualify", r"am i qualif", r"do i qualif", r"can i (get|qualify).{0,10}(a )?(car|finance)", r"want to check if i", r"i want car", r"i just need a car", r"bu[sy]{2,3} a car", r"wanna (buy|busy|get) a car", r"looking for a car"]},
 {"name":"greeting","priority":100,"action":"qr","target":"questions morning",
  "patterns":[r"^\s*(hi|hey|hello|good\s*(morning|afternoon|evening)|molo|sawubona|dumela|goeie|hallo|greetings)\b"],
  "note":"Evaluated last: any specific intent outranks a plain greeting."},
]

# Intents with NO reliable canned answer -> always escalate to a human.
ESCALATION = [
 {"name":"rent_to_own","reason":"No standard policy captured for rent-to-own; answered case-by-case.",
  "patterns":[r"rent.?to.?own", r"rent to buy"]},
 {"name":"application_status","reason":"Live bank feedback required - must be checked by a human/agent.",
  "patterns":[r"(feedback|update|news|response|word).{0,15}(bank|application|app|finance)", r"status of my (app|application)", r"did (you|it) (submit|go through)", r"has.{0,10}been (approved|submitted)", r"\bany (feedback|news|update|word)\b", r"submitted.{0,15}application"]},
 {"name":"specific_vehicle_availability","reason":"Live stock/price check needed for a specific listed vehicle.",
  "patterns":[r"still available", r"is the .{0,30}(available|in stock)", r"price of the \w+", r"\br ?\d{4,}\b.{0,20}(available|this car|that car|the car)", r"interested in (the|this) \d{4}"]},
 {"name":"talk_to_human","reason":"Explicit request for a person / phone call.",
  "patterns":[r"(talk|speak|chat).{0,15}(human|person|someone|agent|consultant|manager|you guys)", r"can i (call|phone)", r"call me", r"phone me", r"\byour number\b", r"come in contact", r"get in touch", r"how (can|do) i (reach|contact)", r"contact you"]},
 {"name":"legal_or_complaint","hard":True,"reason":"Legal threat / complaint - must be handled by a human.",
  "patterns":[r"lawyer", r"legal action", r"ombud", r"popia", r"report you", r"take you to", r"consumer (council|protection)", r"\brefund\b"]},
 {"name":"abuse","hard":True,"reason":"Abusive/hostile - de-escalate with a human.",
  "patterns":[r"\b(fuck|thief|thieves|fraudster|liar|useless|idiot|nonsense|bullshit)\b", r"you.{0,15}(are|guys are|re).{0,10}scam", r"this is.{0,10}scam", r"\bscammers\b", r"\bfrauds?\b"]},
]

# =============================================================================
# 5) BUSINESS RULES (facts the answers rely on). Values with * have source
#    inconsistencies flagged in the playbook — confirm the correct figure.
# =============================================================================
BUSINESS_RULES = {
 "min_income_employed_net_pm": 8500,
 "min_income_self_employed_pm": 20000,   # *INCONSISTENT in source: R14k / R15k / R20k / R25k seen. Confirm.
 "licence_required": True,
 "learners_accepted": False,
 "nominated_driver_allowed": True,
 "deposit_required": False,
 "deposit_effect_per_10000_rands": 200,   # every R10,000 deposit lowers instalment ~R200pm
 "based_in": "Pretoria",
 "delivery": "Nationwide, free of charge",
 "referral_fee_rands": 5000,              # some replies say R1000-R5000 / R1000-R10000
 "docs_required": ["ID","Driver's License","Latest 3 payslips","3 months bank statements"],
 "installment_range_pm": "R3800 - R5000",
 "clearscore_target": 610,
 "banks_total": 5,
 "banks_requiring_account_number": 3,
 "email": "finance@luminaauto.co.za",
 "website": "luminaauto.co.za",
 "inventory_url": "https://luminaauto.co.za/inventory",
 "referral_button": "Money Maker",
 "office_days": "Weekdays only",
 "feedback_timing": "Apps submitted same day; bank feedback typically next afternoon",
 "vehicle_types": ["new","used","demo"],
 "brands": "All brands (VW, Suzuki, Renault, Hyundai, BMW, Ford, etc.)",
 "agent_persona": "Albert from Lumina Auto",
 "hands_off_tags": ["Approved - Need Docs", "Validations Pending", "Vals Done"],
}

# =============================================================================
# 6) TAG TAXONOMY (EasySocial lead tags observed, with counts in the sample)
# =============================================================================
TAGS = [
 {"name":"New Lead","meaning":"Fresh lead, not yet qualified","count":579},
 {"name":"TikTok Ads Lead","meaning":"Came from a TikTok lead form","count":240},
 {"name":"Blacklisted","meaning":"Under debt review / blacklisted / ITC","count":184},
 {"name":"Bad Credit","meaning":"Missed payments / arrears / low score","count":136},
 {"name":"No Licence","meaning":"No valid driver's licence","count":85},
 {"name":"App Submitted","meaning":"Application submitted to banks","count":76},
 {"name":"Application Received","meaning":"Docs/application received from client","count":63},
 {"name":"Application Declined","meaning":"Bank declined","count":47},
 {"name":"Low Income","meaning":"Below income threshold","count":11},
 {"name":"Approved - Need Docs","meaning":"Approved, awaiting documents","count":1},
 {"name":"Validations Pending","meaning":"Bank validations pending","count":2},
]

SEQUENCES = [
 {"name":"credit_diagnostic","steps":["whyscore","arrears"],
  "trigger":"vague bad/low credit with no specifics and unknown profile",
  "note":"Mirrors the human takeover: ask 'Why is your credit score low?' then '/arrears' before giving advice. Once the client answers (arrears/missed -> badcredit; debt review/blacklisted -> debtreview; no credit -> nocredit), the next turn sends the right advice."},
]

WINDOW_POLICY = {
 "free_form_hours": 24,
 "beyond_24h_action": "TEMPLATE_ONLY",
 "note": "WhatsApp only allows approved template messages after 24h of no inbound user message. "
         "EasySocial shows '24 Hour Window Elapsed - Send Template'. The engine must, for stale "
         "chats, send a re-engagement TEMPLATE (e.g. no_reply_reminder / excited_qualify_5min) "
         "instead of a free-form quick reply.",
 "reengage_templates": [30748, 30743, 30745],
}

META = {
 "business": "Lumina Auto",
 "business_id": 4026,
 "agent": "Albert",
 "source": "1,430 already-read EasySocial conversations (read-only analysis)",
 "channel": "WhatsApp via EasySocial (app.easysocial.io / api.easysocial.in)",
 "generated_by": "standalone analysis - no third-party tools",
}

# =============================================================================
# EMIT
# =============================================================================
def sql_str(s):
    if s is None: return "NULL"
    return "'" + str(s).replace("'", "''") + "'"

def sql_json(obj):
    return "'" + json.dumps(obj, ensure_ascii=False).replace("'", "''") + "'::jsonb"

def main():
    here = os.path.dirname(os.path.abspath(__file__))
    kb = {
        "meta": META,
        "business_rules": BUSINESS_RULES,
        "window_policy": WINDOW_POLICY,
        "quick_replies": QUICK_REPLIES,
        "templates": TEMPLATES,
        "funnel": FUNNEL,
        "intents": INTENTS,
        "escalation": ESCALATION,
        "tags": TAGS,
        "hands_off_tags": BUSINESS_RULES["hands_off_tags"],
        "learned_replies": [],
        "sequences": SEQUENCES,
    }
    with open(os.path.join(here, "knowledge_base.json"), "w", encoding="utf-8") as f:
        json.dump(kb, f, ensure_ascii=False, indent=2)

    lines = []
    lines.append("-- seed.sql  —  GENERATED by data/build_kb.py. Do not edit by hand.")
    lines.append("-- Lumina Auto standalone chat responder knowledge base.")
    lines.append("-- Safe to re-run: truncates KB tables then re-inserts.\n")
    lines.append("begin;")
    lines.append("truncate table intent, escalation_rule, funnel_node, reply_sequence, quick_reply, wa_template, business_rule, lead_tag restart identity cascade;\n")

    for q in QUICK_REPLIES:
        lines.append(f"insert into quick_reply (keyword, message) values ({sql_str(q['keyword'])}, {sql_str(q['message'])});")
    lines.append("")

    for t in TEMPLATES:
        lines.append("insert into wa_template (template_id, name, category, body, buttons, usage_count) values "
                     f"({t['id']}, {sql_str(t['name'])}, {sql_str(t['category'])}, {sql_str(t['body'])}, {sql_json(t['buttons'])}, {t['usage']});")
    lines.append("")

    for n in FUNNEL:
        lines.append("insert into funnel_node (code, question, options) values "
                     f"({sql_str(n['code'])}, {sql_str(n['question'])}, {sql_json(n['options'])});")
    lines.append("")

    for sq in SEQUENCES:
        lines.append("insert into reply_sequence (name, steps, note) values "
                     f"({sql_str(sq['name'])}, {sql_json(sq['steps'])}, {sql_str(sq.get('note'))});")
    lines.append("")

    for it in INTENTS:
        lines.append("insert into intent (name, priority, action, target, patterns, note) values "
                     f"({sql_str(it['name'])}, {it['priority']}, {sql_str(it['action'])}, {sql_str(it.get('target'))}, "
                     f"{sql_json(it['patterns'])}, {sql_str(it.get('note'))});")
    lines.append("")

    for e in ESCALATION:
        lines.append("insert into escalation_rule (name, reason, patterns, hard) values "
                     f"({sql_str(e['name'])}, {sql_str(e['reason'])}, {sql_json(e['patterns'])}, {str(bool(e.get('hard'))).lower()});")
    lines.append("")

    for k, v in BUSINESS_RULES.items():
        lines.append(f"insert into business_rule (key, value) values ({sql_str(k)}, {sql_json(v)});")
    lines.append("")

    for tg in TAGS:
        lines.append("insert into lead_tag (name, meaning, sample_count) values "
                     f"({sql_str(tg['name'])}, {sql_str(tg['meaning'])}, {tg['count']});")
    lines.append("\ncommit;")

    db_dir = os.path.join(here, "..", "db")
    os.makedirs(db_dir, exist_ok=True)
    with open(os.path.join(db_dir, "seed.sql"), "w", encoding="utf-8") as f:
        f.write("\n".join(lines))

    print(f"OK  quick_replies={len(QUICK_REPLIES)} templates={len(TEMPLATES)} "
          f"funnel={len(FUNNEL)} intents={len(INTENTS)} escalation={len(ESCALATION)} "
          f"rules={len(BUSINESS_RULES)} tags={len(TAGS)}")

if __name__ == "__main__":
    main()
