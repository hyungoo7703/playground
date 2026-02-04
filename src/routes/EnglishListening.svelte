<script>
    import { onMount, onDestroy, tick } from "svelte";

    let isSupported = false;
    let synth = null;
    let voices = [];
    let voice1 = null; // Male-ish preference
    let voice2 = null; // Female-ish preference

    let currentScriptIndex = 0;
    let currentLineIndex = -1; // -1 means nothing playing
    let isPlaying = false;
    let speechRate = 1.0;
    let showSubtitle = false; // Toggle state for subtitles

    // 10 Varied & Long Dialogue Scripts with Korean translations
    const scripts = [
        {
            title: "1. At the Airport (Check-in & Security)",
            content: `Agent: Good morning. Can I see your ticket and passport, please?
Traveler: Here you go. I have an e-ticket on my phone.
Agent: That works. Are you checking any bags today?
Traveler: Yes, just this one suitcase. And I have a carry-on and a backpack.
Agent: Alright. Place your suitcase on the scale. perfect. It's well within the weight limit. Here is your boarding pass. Your flight leaves from Gate 42B, and boarding begins at 10:30.
Traveler: Thank you. Is security strict today?
Agent: It's quite busy. You should head there immediately. Remember to take your laptop and liquids out of your bag.
Traveler: Will do. Oh, one more thing, is there a delay on the flight?
Agent: Currently, it's on time. But keep an eye on the monitors just in case. Have a safe flight!
Traveler: Thanks for your help. Have a good day.`,
            contentKo: `직원: 좋은 아침입니다. 티켓과 여권을 보여주시겠습니까?
여행객: 여기 있습니다. 휴대폰에 전자 티켓이 있어요.
직원: 됐습니다. 부치실 짐이 있나요?
여행객: 네, 이 가방 하나요. 그리고 기내용 가방과 배낭이 있습니다.
직원: 알겠습니다. 가방을 저울에 올려주세요. 완벽하네요. 무게 제한 내에 있습니다. 탑승권 여기 있습니다. 42B 게이트에서 출발하며, 10시 30분부터 탑승 시작입니다.
여행객: 감사합니다. 오늘 보안 검색이 엄격한가요?
직원: 꽤 붐비네요. 바로 가시는 게 좋겠습니다. 노트북과 액체류는 가방에서 꺼내는 거 잊지 마시고요.
여행객: 알겠습니다. 아, 한 가지 더요, 비행기 지연이 있나요?
직원: 현재로서는 정시 출발입니다. 하지만 혹시 모르니 모니터를 계속 확인하세요. 안전한 여행 되세요!
여행객: 도와주셔서 감사합니다. 좋은 하루 보내세요.`,
        },
        {
            title: "2. Job Interview (Experience & Strengths)",
            content: `Interviewer: Welcome, Sarah. Thank you for coming in. I've reviewed your resume, and I'm impressed by your background.
Sarah: Thank you for having me. I'm excited to learn more about this opportunity.
Interviewer: Let's start with your last role. Can you describe a significant challenge you faced and how you overcame it?
Sarah: Certainly. In my previous project, we faced a sudden deadline cut. The team was stressed, so I reorganized our workflow, prioritized critical tasks, and facilitated daily stand-ups to improved communication. We managed to deliver on time with zero defects.
Interviewer: That's impressive. What would you say is your greatest strength?
Sarah: I believe it's my adaptability. I thrive in fast-paced environments and enjoy learning new technologies quickly to solve problems efficiently.
Interviewer: That fits well with our culture. Do you have any questions for us?
Sarah: Yes, I'd love to know more about the team structure and how cross-functional collaboration is handled here.`,
            contentKo: `면접관: 어서 오세요, 사라 씨. 와주셔서 감사합니다. 이력서를 검토했는데, 경력이 인상적이더군요.
사라: 초대해 주셔서 감사합니다. 이 기회에 대해 더 알게 되어 기쁩니다.
면접관: 마지막 직무부터 시작해 볼까요. 직면했던 중요한 도전 과제와 그것을 어떻게 극복했는지 설명해 주시겠습니까?
사라: 물론입니다. 지난 프로젝트에서 갑작스럽게 마감 기한이 단축되었습니다. 팀이 스트레스를 받았기 때문에, 저는 업무 흐름을 재조정하고 중요한 작업을 우선순위화했으며, 일일 스탠드업 미팅을 주재하여 소통을 개선했습니다. 덕분에 결함 없이 제시간에 납품할 수 있었습니다.
면접관: 인상적이군요. 본인의 가장 큰 장점은 무엇이라고 생각합니까?
사라: 저의 적응력이라고 생각합니다. 저는 빠르게 진행되는 환경에서 성장하며, 문제를 효율적으로 해결하기 위해 새로운 기술을 빨리 배우는 것을 즐깁니다.
면접관: 우리 기업 문화와 잘 맞는군요. 질문 있으신가요?
사라: 네, 팀 구조와 부서 간 협업이 어떻게 이루어지는지 더 알고 싶습니다.`,
        },
        {
            title: "3. Medical Appointment (Symptoms & Advice)",
            content: `Doctor: Good afternoon, Mr. Jones. What brings you in today?
Patient: Hi Doctor. I've been having this persistent headache for the past three days, and I'm feeling quite fatigued.
Doctor: I see. Have you experienced any dizziness or nausea along with the headache?
Patient: A little bit of nausea yesterday, but no dizziness. It mostly hurts right behind my eyes.
Doctor: Okay, let me check your blood pressure and temperature. Hmm, your pressure is a bit high. Have you been under a lot of stress lately?
Patient: Actually, yes. Work has been very intense this month.
Doctor: That could be the primary cause. I'm going to prescribe a mild pain reliever, but more importantly, you need to rest. Try to reduce your screen time and stay hydrated.
Patient: I will try. Do I need to come back for a follow-up?
Doctor: If the pain doesn't subside in two days, please call us immediately. Take care.`,
            contentKo: `의사: 안녕하세요, 존스 씨. 어디가 불편해서 오셨나요?
환자: 안녕하세요 선생님. 지난 3일 동안 계속 두통이 있고, 꽤 피로감을 느낍니다.
의사: 그렇군요. 두통과 함께 어지러움이나 메스꺼움을 느끼신 적이 있나요?
환자: 어제 약간 메스꺼움이 있었지만, 어지러움은 없었습니다. 주로 눈 바로 뒤쪽이 아픕니다.
의사: 알겠습니다. 혈압과 체온을 확인해 보겠습니다. 흠, 혈압이 조금 높네요. 최근에 스트레스를 많이 받으셨나요?
환자: 사실 그렇습니다. 이번 달에 업무가 매우 힘들었어요.
의사: 그게 주원인일 수 있습니다. 약한 진통제를 처방해 드리겠지만, 더 중요한 건 휴식입니다. 화면 보는 시간을 줄이고 수분을 충분히 섭취하세요.
환자: 노력해 보겠습니다. 다시 와야 하나요?
의사: 이틀 내에 통증이 가라앉지 않으면 즉시 전화 주세요. 몸 조리 잘하세요.`,
        },
        {
            title: "4. Hotel Check-in (Upgrades & Amenities)",
            content: `Receptionist: Good evening, welcome to the Grand Hotel. How can I assist you?
Guest: Hi, I have a reservation under the name Walker.
Receptionist: Let me pull that up... Yes, I see it. A standard king room for three nights.
Guest: Actually, I was wondering if there are any upgrades available? It's our anniversary.
Receptionist: Let me check properly. Congratulations! We do have a Sea View Suite available. Since it's a special occasion, I can offer it to you for just a small additional fee.
Guest: That sounds lovely. Does it come with breakfast?
Receptionist: Yes, the suite includes our full buffet breakfast and access to the executive lounge.
Guest: Perfect, we'll take it. By the way, what time does the pool close?
Receptionist: The pool and gym are open until 10 PM. Here represent your key cards. You are in room 1204. Enjoy your stay!`,
            contentKo: `접수원: 안녕하세요, 그랜드 호텔에 오신 것을 환영합니다. 무엇을 도와드릴까요?
투숙객: 안녕하세요, 워커라는 이름으로 예약했습니다.
접수원: 확인해 보겠습니다... 네, 여기 있네요. 스탠다드 킹 룸 3박입니다.
투숙객: 혹시 객실 업그레이드가 가능한지 궁금해요. 저희 기념일이라서요.
접수원: 제대로 확인해 보겠습니다. 축하드립니다! 바다 전망 스위트룸이 비어 있습니다. 특별한 날이니 소정의 추가 요금으로 제공해 드릴 수 있습니다.
투숙객: 멋지네요. 조식도 포함되나요?
접수원: 네, 스위트룸에는 조식 뷔페와 이그제큐티브 라운지 이용이 포함됩니다.
투숙객: 완벽하네요, 그걸로 할게요. 그나저나 수영장은 몇 시에 닫나요?
접수원: 수영장과 체육관은 밤 10시까지 운영합니다. 여기 카드 키입니다. 객실은 1204호입니다. 편안한 시간 보내세요!`,
        },
        {
            title: "5. Tech Support (Internet Issues)",
            content: `Agent: Technical Support, this is Mike. How can I help you?
Customer: Hi Mike, my home internet has been down for the last hour. I've tried restarting the router, but nothing happened.
Agent: I apologize for the inconvenience. Let me run a diagnostic on your line. Can you please confirm your account number?
Customer: Sure, it's 884-291-003.
Agent: Thank you. I see the signal is indeed dropping. It looks like there's an outage in your area due to maintenance.
Customer: Oh no, how long will it take to fix? I work from home and need to join a meeting soon.
Agent: The field technicians are already on site. It should be back up within 30 minutes. In the meantime, I can add 10GB of data to your mobile plan if your phone is with us.
Customer: That would be a lifesaver! Thank you so much.
Agent: Consider it done. Is there anything else I can help you with today?`,
            contentKo: `상담원: 기술 지원팀 마이크입니다. 무엇을 도와드릴까요?
고객: 안녕하세요 마이크 씨, 지난 한 시간 동안 집 인터넷이 안 돼요. 라우터를 재부팅 해봤는데 아무 변화가 없네요.
상담원: 불편을 드려 죄송합니다. 회선 진단을 실행해 보겠습니다. 계정 번호를 확인해 주시겠습니까?
고객: 네, 884-291-003입니다.
상담원: 감사합니다. 신호가 끊기는 게 확인되네요. 점검으로 인해 해당 지역에 정전이 발생한 것 같습니다.
고객: 이런, 고치는 데 얼마나 걸릴까요? 재택근무 중이라 곧 회의에 들어가야 하거든요.
상담원: 현장 기술자들이 이미 현장에 나가 있습니다. 30분 내로 복구될 겁니다. 그동안 고객님 휴대폰이 통신사를 이용 중이시면 모바일 데이터 10GB를 추가해 드릴 수 있습니다.
고객: 정말 다행이네요! 정말 감사합니다.
상담원: 처리해 드렸습니다. 오늘 다른 도와드릴 일은 없으신가요?`,
        },
        {
            title: "6. At a Restaurant (Ordering & Dietary)",
            content: `Server: Hello, are you ready to order, or do you need a few more minutes?
Customer: I think we're ready. But I have a question about the menu. Does the pasta dish contain any nuts? I have a severe allergy.
Server: The pesto sauce does contain pine nuts, but we can substitute it with a marinara sauce which is completely nut-free.
Customer: That would be great. I'll have the marinara pasta then. And for the starter?
Server: Our bruschetta is very popular. It's made with fresh tomatoes and basil.
Customer: Sounds delicious. Let's get that to share. And I'll have a glass of sparkling water.
Server: Excellent choice. And for you, sir?
Partner: I'll have the grilled salmon with roasted vegetables, please.
Server: Certainly. I'll put those orders in right away.`,
            contentKo: `종업원: 안녕하세요, 주문하시겠습니까, 아니면 시간이 조금 더 필요하신가요?
손님: 주문할게요. 그런데 메뉴에 대해 질문이 있어요. 이 파스타 요리에 견과류가 들어가나요? 제가 심한 알레르기가 있어서요.
종업원: 페스토 소스에는 잣이 들어가지만, 견과류가 전혀 없는 마리나라 소스로 변경해 드릴 수 있습니다.
손님: 잘됐네요. 그럼 마리나라 파스타로 주세요. 전채 요리는요?
종업원: 브루스케타가 아주 인기 있습니다. 신선한 토마토와 바질로 만듭니다.
손님: 맛있겠네요. 같이 먹게 그거 하나 주세요. 그리고 탄산수 한 잔 주세요.
종업원: 탁월한 선택이십니다. 그리고 선생님께서는요?
일행: 저는 구운 야채를 곁들인 연어 구이로 주세요.
종업원: 알겠습니다. 바로 주문 넣겠습니다.`,
        },
        {
            title: "7. Shopping for Clothes (Sizing & Style)",
            content: `Shopper: Excuse me, do you have this jacket in a medium?
Assistant: Let me check the rack. It looks like we're out of medium in black, but we have it in navy blue. Would you like to try that?
Shopper: Hmm, I really wanted black. Do you think you can order it from another store?
Assistant: I can check our inventory system... Yes, the downtown branch has two left. I can have it reserved for you to pick up, or we can ship it to your home.
Shopper: Shipping would be amazing. Is there a delivery fee?
Assistant: It's free for purchases over $50, so this qualifies. Let's get your details at the register.
Shopper: Great. Also, does this material wrinkle easily? I need it for travel.
Assistant: Not at all. It's a synthetic blend designed specifically to be wrinkle-resistant.
Shopper: Perfect. Let's do it.`,
            contentKo: `쇼핑객: 실례합니다, 이 재킷 미디엄 사이즈 있나요?
직원: 행거를 확인해 볼게요. 검정색 미디엄은 품절인 것 같은데, 네이비 블루는 있어요. 입어 보시겠어요?
쇼핑객: 흠, 저는 꼭 검정색을 원했거든요. 다른 매장에서 주문할 수 있을까요?
직원: 재고 시스템을 확인해 볼게요... 네, 시내 지점에 두 개 남아있네요. 픽업하실 수 있게 예약해 드리거나, 댁으로 배송해 드릴 수 있습니다.
쇼핑객: 배송해 주시면 정말 좋죠. 배송비가 있나요?
직원: 50달러 이상 구매 시 무료라서, 이 제품은 해당됩니다. 계산대에서 정보를 적어주세요.
쇼핑객: 좋아요. 그리고 이 소재 주름이 잘 가나요? 여행용으로 필요해서요.
직원: 전혀요. 주름 방지용으로 특별히 고안된 합성 혼방 소재입니다.
쇼핑객: 완벽하네요. 이걸로 할게요.`,
        },
        {
            title: "8. University Consultant (Assignment Help)",
            content: `Student: Professor, do you have a moment to discuss the final essay?
Professor: Of course, come in. What's on your mind?
Student: I'm struggling with the thesis statement. I want to argue about the economic impact of renewable energy, but it feels too broad.
Professor: That is a very massive topic. I suggest narrowing it down. perhaps focus on a specific region or a specific type of energy, like solar power in developing countries.
Student: That's a good idea. If I focus on solar power in rural areas, I can find more specific case studies.
Professor: Exactly. That will allow you to go deeper into the analysis rather than just skimming the surface. Remember to acknowledge the counter-arguments as well.
Student: Right. I was thinking of addressing the initial high cost of installation.
Professor: excellent. If you balance that with the long-term benefits, you'll have a strong argument. Draft an outline and send it to me by Friday.`,
            contentKo: `학생: 교수님, 기말 에세이 관련해서 잠시 상담 가능할까요?
교수: 물론이지, 들어오게. 무슨 고민인가?
학생: 논제 정하는 게 어려워서요. 재생 에너지의 경제적 영향에 대해 주장하고 싶은데, 너무 광범위한 것 같아요.
교수: 그건 정말 방대한 주제지. 범위를 좁히는 걸 추천하네. 특정 지역이나 특정 에너지, 예를 들어 개발도상국의 태양광 발전 같은 걸로 말이야.
학생: 좋은 생각이네요. 시골 지역의 태양광 발전에 초점을 맞추면, 더 구체적인 사례 연구를 찾을 수 있겠어요.
교수: 그렇지. 그래야 수박 겉핥기 식이 아니라 깊이 있는 분석을 할 수 있네. 반대 의견도 다루는 걸 잊지 말게.
학생: 네. 초기 설치 비용이 비싸다는 점을 다룰 생각이었습니다.
교수: 훌륭해. 그걸 장기적인 이점과 조화시키면 강력한 주장이 될 걸세. 개요를 작성해서 금요일까지 나에게 보내주게.`,
        },
        {
            title: "9. Travel Agency (Planning a Trip) - Extended",
            content: `Agent: So, you're looking to plan a trip to Europe for two weeks?
Client: Yes, we want to visit Italy and France. We're interested in history and food, not so much nightlife.
Agent: I recommend starting in Rome. You can spend four days exploring the ancient sites like the Colosseum. Then, take a train to Florence for the art and wine.
Client: That sounds lovely. How do we get to France from there?
Agent: The high-speed train from Milan to Paris is scenic and convenient. In Paris, I can book you a hotel in the Latin Quarter; it's very atmospheric and close to great cafes.
Client: What about budget? We'd like to keep it under $5,000 including flights.
Agent: It might be tight during peak season, but if you travel in late September, the weather is still nice and prices are lower.
Client: September works for us. Let's look at some flight options.
Agent: I can see a flight with one stopover in Frankfurt that is very reasonably priced. It departs on the 15th.
Client: A stopover is fine if it's not too long. Does the price include checked luggage?
Agent: Yes, one bag up to 23kg per person. Shall I tentatively block these seats for 24 hours?
Client: Please do. We need to double-check our vacation days with work.
Agent: No problem. I'll email you the itinerary. Once you confirm, we can start looking at tours and restaurant reservations.
Client: Perfect. You've made this so much easier. Thank you!`,
            contentKo: `상담원: 2주 동안 유럽 여행을 계획하고 계신다고요?
고객: 네, 이탈리아와 프랑스를 방문하고 싶어요. 역사와 음식에 관심이 있고, 밤문화는 별로예요.
상담원: 로마에서 시작하는 걸 추천합니다. 4일 동안 콜로세움 같은 고대 유적지를 둘러보시고요. 그 다음 기차로 피렌체로 가서 예술과 와인을 즐기세요.
고객: 멋지네요. 거기서 프랑스로는 어떻게 가나요?
상담원: 밀라노에서 파리로 가는 고속 열차가 경치도 좋고 편리합니다. 파리에서는 라틴 지구에 호텔을 잡아드릴 수 있어요. 분위기도 좋고 훌륭한 카페들이 가깝거든요.
고객: 예산은 어떤가요? 항공권 포함해서 5,000달러 이하로 맞추고 싶어서요.
상담원: 성수기에는 빠듯할 수 있지만, 9월 말에 여행하시면 날씨도 여전히 좋고 가격도 더 저렴합니다.
고객: 9월은 괜찮아요. 항공편 옵션 좀 볼게요.
상담원: 프랑크푸르트를 한 번 경유하는 항공편이 가격이 아주 합리적이네요. 15일에 출발합니다.
고객: 경유 시간이 너무 길지만 않다면 괜찮아요. 수하물 포함된 가격인가요?
상담원: 네, 1인당 23kg 가방 한 개 포함입니다. 24시간 동안 좌석을 임시로 잡아둘까요?
고객: 네, 해주세요. 회사에 휴가 날짜를 다시 확인해 봐야 해서요.
상담원: 문제없습니다. 일정표를 이메일로 보내드릴게요. 확정하시면 투어와 식당 예약도 알아봐 드릴 수 있습니다.
고객: 완벽하네요. 덕분에 훨씬 수월해졌어요. 감사합니다!`,
        },
        {
            title: "10. Business Meeting (Project Update) - Extended",
            content: `Manager: Let's get started. Alex, can you give us an update on the marketing launch?
Alex: Sure. We are on track for the Q3 release. The social media campaign is ready, and the influencers have agreed to the schedule.
Manager: That's good news. What about the budget? Are we staying within the limits?
Alex: We are slightly over budget on the video production side, but we saved money on print ads, so it balances out.
Manager: Okay, just keep an eye on it. Sarah, how is the product testing going?
Sarah: We found a minor bug in the checkout process yesterday. The engineering team is fixing it now. We verify the fix by tomorrow morning.
Manager: Critical bugs needs to be priority zero. Ensure we re-test the entire flow. We can't afford any glitches on launch day.
Alex: Agreed. We'll sync up with engineering later today to ensure they have the resources they need.
Manager: Thanks. Also, have we prepared the FAQ section for the customer support team? They need to be ready for incoming queries.
Sarah: I have a draft ready. I'm waiting for the product owner to approve the final technical details.
Manager: Push that forward. I want customer support trained by next week. We are expecting high traffic.
Alex: I'll assist Sarah with the documentation. We can present the final version at the Friday meeting.
Manager: Great plan. Let's keep the momentum going. Meeting adjourned.`,
            contentKo: `매니저: 시작합시다. 알렉스, 마케팅 출시 상황 좀 업데이트해 주겠어요?
알렉스: 네. 3분기 출시에 맞춰 순조롭게 진행 중입니다. 소셜 미디어 캠페인은 준비되었고, 인플루언서들도 일정에 동의했습니다.
매니저: 좋은 소식이네요. 예산은 어떤가요? 한도 내에서 유지되고 있나요?
알렉스: 영상 제작 쪽에서 예산을 약간 초과했지만, 인쇄 광고비를 아껴서 균형이 맞습니다.
매니저: 알겠습니다. 계속 주시하세요. 사라, 제품 테스트는 어떻게 되어가나요?
사라: 어제 결제 프로세스에서 작은 버그를 발견했습니다. 지금 엔지니어링 팀이 수정 중입니다. 내일 아침까지 수정 사항을 검증할 예정입니다.
매니저: 치명적인 버그는 최우선 순위여야 합니다. 전체 흐름을 다시 테스트하도록 하세요. 출시 당일에는 어떤 오류도 용납할 수 없습니다.
알렉스: 동감입니다. 오늘 오후에 엔지니어링 팀과 미팅해서 필요한 자원이 있는지 확인할게요.
매니저: 고마워요. 그리고 고객 지원팀을 위한 FAQ 섹션은 준비되었나요? 들어오는 문의에 대비해야 합니다.
사라: 초안은 준비되었습니다. 최종 기술 세부 사항에 대해 제품 책임자의 승인을 기다리고 있습니다.
매니저: 서두르세요. 다음 주까지 고객 지원팀 교육을 마쳤으면 합니다. 접속량이 많을 것으로 예상되니까요.
알렉스: 제가 사라의 문서 작업을 돕겠습니다. 금요일 회의 때 최종본을 발표할 수 있을 겁니다.
매니저: 좋은 계획입니다. 계속 박차를 가합시다. 회의 마칩니다.`,
        },
    ];

    // Reactive Parsed Lines
    // Zip English and Korean lines together
    $: parsedLines = scripts[currentScriptIndex].content
        .split("\n")
        .map((line, i) => {
            const parts = line.split(":");
            const koLine = scripts[currentScriptIndex].contentKo
                ? scripts[currentScriptIndex].contentKo.split("\n")[i]
                : "";

            if (parts.length > 1) {
                return {
                    speaker: parts[0].trim(),
                    text: parts.slice(1).join(":").trim(),
                    original: line,
                    textKo: koLine, // Add Korean text
                };
            }
            return { speaker: "", text: line, original: line, textKo: koLine };
        });

    onMount(() => {
        if ("speechSynthesis" in window) {
            isSupported = true;
            synth = window.speechSynthesis;
            loadVoices();
            if (synth.onvoiceschanged !== undefined) {
                synth.onvoiceschanged = loadVoices;
            }
        }
    });

    onDestroy(() => {
        if (synth) {
            synth.cancel();
        }
    });

    function loadVoices() {
        const allVoices = synth.getVoices();

        // Filter for English voices (broadly)
        const enVoices = allVoices.filter((v) => v.lang.startsWith("en"));

        // 1. Try to find explicit Female voice
        // Common names: Zira (Win), Google UK English Female, Samantha (Mac), Susan, Cortana
        const femaleParams = [
            "Female",
            "Zira",
            "Susan",
            "Samantha",
            "Google UK",
        ];
        let female = enVoices.find((v) =>
            femaleParams.some((p) => v.name.includes(p)),
        );

        // 2. Try to find explicit Male voice
        // Common names: David (Win), Mark (Win), Google US English, Daniel (Mac)
        const maleParams = ["Male", "David", "Mark", "Google US", "Daniel"];
        let male = enVoices.find((v) =>
            maleParams.some((p) => v.name.includes(p)),
        );

        // 3. Fallbacks logic
        // If we found a female but no male, find any other voice to be the male
        if (female && !male) {
            male = enVoices.find((v) => v !== female);
        }
        // If we found a male but no female, find any other voice to be the female
        if (male && !female) {
            female = enVoices.find((v) => v !== male);
        }

        // If neither found specifically, just pick the first two available English voices
        if (!male && !female && enVoices.length >= 2) {
            male = enVoices[0];
            female = enVoices[1];
        }

        // Final Assignment
        // If absolutely no English voices, fallback to whatever is available
        voice1 = male || allVoices[0];
        voice2 = female || allVoices.find((v) => v !== voice1) || voice1;

        // Ensure they are not the same if we have options
        if (voice1 === voice2 && enVoices.length > 1) {
            voice2 = enVoices.find((v) => v !== voice1) || voice2;
        }
    }

    function playScript() {
        if (!synth) return;
        synth.cancel();
        isPlaying = true;

        if (currentLineIndex === -1) {
            playLine(0);
        } else {
            playLine(currentLineIndex);
        }
    }

    function playLine(index) {
        if (!isPlaying) return;
        if (index >= parsedLines.length) {
            isPlaying = false;
            currentLineIndex = -1;
            return;
        }

        currentLineIndex = index;
        scrollToActiveLine();

        const line = parsedLines[index];
        const textToSpeak = line.text || line.original;

        const utterance = new SpeechSynthesisUtterance(textToSpeak);
        utterance.lang = "en-US";
        utterance.rate = speechRate;

        // Voice Assignment Logic
        const speakers = [
            ...new Set(parsedLines.map((l) => l.speaker).filter((s) => s)),
        ];
        const speakerIndex = speakers.indexOf(line.speaker);
        let selectedVoice = voice1;

        if (speakerIndex !== -1) {
            selectedVoice = speakerIndex % 2 === 0 ? voice1 : voice2;
        }

        utterance.voice = selectedVoice;

        // Fallback/Enhancement: Force Tone Difference
        // Even if they are different voices, a slight pitch shift helps distinctiveness.
        // Voice 1 (Male-ish) -> 0.9 (Lower)
        // Voice 2 (Female-ish) -> 1.1 (Higher)
        // If the user has just one voice, this creates a fake duet.
        if (speakerIndex % 2 === 0) {
            utterance.pitch = 0.9;
        } else {
            utterance.pitch = 1.1;
        }

        utterance.onend = () => {
            if (isPlaying) {
                playLine(index + 1);
            }
        };

        utterance.onerror = (e) => {
            console.error("Speech error", e);
            isPlaying = false;
        };

        synth.speak(utterance);
    }

    async function scrollToActiveLine() {
        await tick();
        const el = document.getElementById(`line-${currentLineIndex}`);
        if (el) {
            el.scrollIntoView({ behavior: "smooth", block: "center" });
        }
    }

    function stopScript() {
        if (synth) {
            synth.cancel();
            isPlaying = false;
            currentLineIndex = -1;
        }
    }

    function changeScript(index) {
        currentScriptIndex = index;
        stopScript();
    }

    function updateRate(e) {
        speechRate = parseFloat(e.target.value);
        if (isPlaying && currentLineIndex !== -1) {
            synth.cancel();
            playLine(currentLineIndex);
        }
    }

    function toggleSubtitle() {
        showSubtitle = !showSubtitle;
    }
</script>

<div
    class="max-w-6xl mx-auto p-4 md:p-6 bg-white dark:bg-gray-900 rounded-3xl shadow-2xl h-[calc(100dvh-100px)] flex flex-col"
>
    <!-- Header -->
    <div
        class="flex flex-col md:flex-row justify-between items-center mb-4 gap-4 shrink-0"
    >
        <h1
            class="text-2xl md:text-3xl font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-6 py-2 rounded-2xl shadow-sm"
        >
            🎧 English Listening
        </h1>

        <div class="flex gap-3">
            <!-- Subtitle Toggle -->
            <button
                on:click={toggleSubtitle}
                class="px-4 py-2 rounded-xl font-bold transition-colors shadow-sm text-sm md:text-base
                {showSubtitle
                    ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                    : 'bg-gray-200 text-gray-600 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300'}"
            >
                {showSubtitle ? "한글 ON" : "한글 OFF"}
            </button>

            <!-- Play/Stop Button (Moved to Header) -->
            {#if isPlaying}
                <button
                    on:click={stopScript}
                    class="px-5 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl font-bold flex items-center gap-2 transition shadow-sm animate-pulse"
                >
                    <svg
                        class="w-5 h-5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                    >
                        <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="3"
                            d="M6 18L18 6M6 6l12 12"
                        />
                    </svg>
                    <span>STOP</span>
                </button>
            {:else}
                <button
                    on:click={playScript}
                    class="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold flex items-center gap-2 transition shadow-sm"
                >
                    <svg
                        class="w-5 h-5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                    >
                        <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="3"
                            d="M5 3l14 9-14 9V3z"
                        />
                    </svg>
                    <span>PLAY</span>
                </button>
            {/if}
        </div>
    </div>

    {#if !isSupported}
        <div
            class="p-6 bg-red-100 text-red-700 rounded-2xl border border-red-200"
        >
            ⚠️ Your browser does not support the Web Speech API. Please use
            Chrome, Edge, or Safari.
        </div>
    {:else}
        <div
            class="flex flex-col-reverse lg:flex-row gap-4 flex-1 overflow-hidden"
        >
            <!-- Sidebar: Script List (Reduced height for more content space) -->
            <div
                class="w-full lg:w-1/3 flex flex-col gap-2 h-auto max-h-[25vh] lg:h-auto overflow-y-auto pr-2 custom-scrollbar shrink-0 border-t pt-2 lg:pt-0 lg:border-t-0 lg:border-r border-gray-100 dark:border-gray-800"
            >
                {#each scripts as script, i}
                    <button
                        on:click={() => changeScript(i)}
                        class="text-left p-3 rounded-xl border-2 transition-all duration-200 group relative overflow-hidden shrink-0
                        {currentScriptIndex === i
                            ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 shadow-md'
                            : 'border-transparent bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700'}"
                    >
                        <div
                            class="font-bold text-sm md:text-lg mb-1 whitespace-normal break-words leading-snug {currentScriptIndex ===
                            i
                                ? 'text-indigo-700 dark:text-indigo-300'
                                : 'text-gray-700 dark:text-gray-200'}"
                        >
                            {script.title}
                        </div>
                        {#if currentScriptIndex === i && isPlaying}
                            <div
                                class="absolute right-4 top-1/2 -translate-y-1/2 flex gap-1"
                            >
                                <span
                                    class="w-1 h-3 bg-indigo-500 animate-pulse"
                                ></span>
                                <span
                                    class="w-1 h-5 bg-indigo-500 animate-pulse delay-75"
                                ></span>
                                <span
                                    class="w-1 h-2 bg-indigo-500 animate-pulse delay-150"
                                ></span>
                            </div>
                        {/if}
                    </button>
                {/each}
            </div>

            <!-- Main Content: Display Only (Controls removed) -->
            <div
                class="w-full lg:w-2/3 flex flex-col bg-gray-50 dark:bg-gray-800 rounded-3xl p-4 md:p-8 relative border border-gray-100 dark:border-gray-700 overflow-hidden"
            >
                <!-- Script Content: Removed massive bottom padding -->
                <div
                    class="flex-1 overflow-y-auto pb-4 pr-2 custom-scrollbar scroll-smooth"
                >
                    {#each parsedLines as line, i}
                        <div
                            id="line-{i}"
                            class="mb-6 text-lg md:text-xl leading-relaxed font-medium transition-colors duration-300 flex flex-col justify-center
                            {currentLineIndex === i
                                ? 'bg-indigo-50 dark:bg-indigo-900/40 p-6 rounded-2xl border-l-8 border-indigo-500 shadow-lg transform scale-[1.02] origin-left'
                                : 'p-4'}"
                        >
                            {#if line.speaker}
                                <span
                                    class="font-bold text-sm uppercase tracking-wider block mb-1 {currentLineIndex ===
                                    i
                                        ? 'text-indigo-600 dark:text-indigo-400'
                                        : 'text-gray-400 dark:text-gray-500'}"
                                >
                                    {line.speaker}
                                </span>
                            {/if}
                            <span
                                class="text-gray-900 dark:text-gray-50 font-semibold"
                                >{line.text}</span
                            >

                            <!-- Korean Subtitle -->
                            {#if showSubtitle && line.textKo}
                                <span
                                    class="text-sm md:text-base text-gray-500 dark:text-gray-400 mt-1 font-normal break-keep"
                                >
                                    {line.textKo}
                                </span>
                            {/if}
                        </div>
                    {/each}
                </div>
            </div>
        </div>
    {/if}

    <!-- Voice Debug Info (Visible for troubleshooting) -->
    <div
        class="mt-4 p-4 bg-gray-100 dark:bg-gray-800 rounded-2xl text-xs text-gray-500 overflow-x-auto"
    >
        <p class="font-bold mb-2">🎤 Voice Debug Info:</p>
        <p>
            Selected Voice 1 (Male?): <span class="text-indigo-600 font-bold"
                >{voice1?.name}</span
            >
            ({voice1?.lang})
        </p>
        <p>
            Selected Voice 2 (Female?): <span class="text-pink-600 font-bold"
                >{voice2?.name}</span
            >
            ({voice2?.lang})
        </p>
    </div>
</div>

<style>
    .custom-scrollbar::-webkit-scrollbar {
        width: 6px;
    }
    .custom-scrollbar::-webkit-scrollbar-track {
        background: transparent;
    }
    .custom-scrollbar::-webkit-scrollbar-thumb {
        background-color: #e2e8f0;
        border-radius: 20px;
    }
    :global(.dark) .custom-scrollbar::-webkit-scrollbar-thumb {
        background-color: #4b5563;
    }
    .scroll-smooth {
        scroll-behavior: smooth;
    }
</style>
