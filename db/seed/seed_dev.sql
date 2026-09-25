BEGIN;

-- Deterministic DEVELOPMENT/QA fixtures only. These are not production organization names.
-- Production launch data must be imported from the approved HUB roster/template.

INSERT INTO vocabulary_types(code,label) VALUES
 ('REGION','Region'),('DOMAIN','Domain'),('SKILL','Skill')
ON CONFLICT DO NOTHING;

INSERT INTO vocabulary_items(id,type_code,slug,label,sort_order,status) VALUES
 ('00000000-0000-0000-0000-000000000101','REGION','hanoi','Hà Nội',10,'ACTIVE'),
 ('00000000-0000-0000-0000-000000000201','DOMAIN','innovation','Đổi mới sáng tạo',10,'ACTIVE'),
 ('00000000-0000-0000-0000-000000000301','SKILL','product','Product',10,'ACTIVE'),
 ('00000000-0000-0000-0000-000000000302','SKILL','technology','Technology',20,'ACTIVE')
ON CONFLICT DO NOTHING;

INSERT INTO organizations(id,type,parent_id,slug,name,status) VALUES
 ('10000000-0000-0000-0000-000000000001','HUB',NULL,'hub-network','HUB Network','PUBLISHED'),
 ('10000000-0000-0000-0000-000000000101','CHAPTER','10000000-0000-0000-0000-000000000001','chapter-01','Chapter 01','PUBLISHED'),
 ('10000000-0000-0000-0000-000000000102','CHAPTER','10000000-0000-0000-0000-000000000001','chapter-02','Chapter 02','PUBLISHED'),
 ('10000000-0000-0000-0000-000000000103','CLB','10000000-0000-0000-0000-000000000101','club-01','CLB 01','PUBLISHED')
ON CONFLICT DO NOTHING;

INSERT INTO legal_documents(id,document_type,version,title,content_uri,effective_at) VALUES
 ('20000000-0000-0000-0000-000000000001','TERMS_ACCEPTANCE','p0-2026-09','Điều khoản sử dụng','/legal/terms/p0-2026-09',now()),
 ('20000000-0000-0000-0000-000000000002','PRIVACY_DATA_PROCESSING','p0-2026-09','Chính sách quyền riêng tư','/legal/privacy/p0-2026-09',now())
ON CONFLICT DO NOTHING;

INSERT INTO user_accounts(id,email,email_normalized,status) VALUES
 ('30000000-0000-0000-0000-000000000001','member@example.test','member@example.test','ACTIVE'),
 ('30000000-0000-0000-0000-000000000002','leader@example.test','leader@example.test','ACTIVE'),
 ('30000000-0000-0000-0000-000000000003','ops@example.test','ops@example.test','ACTIVE')
ON CONFLICT DO NOTHING;

INSERT INTO individual_profiles(id,account_id,status,display_name,headline,region_vocab_id,bio,development_goal,current_need,onboarding_completed_at) VALUES
 ('40000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','ACTIVE','Demo Member','HUB Member','00000000-0000-0000-0000-000000000101','Deterministic profile for visual QA.','Kết nối hệ sinh thái','Tìm chương trình phù hợp',now()),
 ('40000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000002','ACTIVE','Demo Leader','Chapter Leader','00000000-0000-0000-0000-000000000101','Deterministic leader profile.','Phát triển Chapter','Kết nối thành viên',now()),
 ('40000000-0000-0000-0000-000000000003','30000000-0000-0000-0000-000000000003','ACTIVE','Demo Ops','Platform Ops','00000000-0000-0000-0000-000000000101','Deterministic ops profile.','Vận hành nền tảng','Theo dõi P0',now())
ON CONFLICT DO NOTHING;

INSERT INTO profile_domains(profile_id,vocab_id) VALUES
 ('40000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000201'),
 ('40000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000201')
ON CONFLICT DO NOTHING;
INSERT INTO profile_skills(profile_id,vocab_id) VALUES
 ('40000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000301'),
 ('40000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000302')
ON CONFLICT DO NOTHING;

INSERT INTO profile_visibility_settings(profile_id,default_level) VALUES
 ('40000000-0000-0000-0000-000000000001','NETWORK_ONLY'),
 ('40000000-0000-0000-0000-000000000002','NETWORK_ONLY'),
 ('40000000-0000-0000-0000-000000000003','PRIVATE')
ON CONFLICT DO NOTHING;

INSERT INTO community_memberships(profile_id,organization_id,state,source,started_at) VALUES
 ('40000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000101','ACTIVE','PRESEED',now()),
 ('40000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000101','ACTIVE','PRESEED',now())
ON CONFLICT DO NOTHING;

INSERT INTO leadership_records(profile_id,organization_id,role_label,state) VALUES
 ('40000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000101','Chapter Leader','ACTIVE');

INSERT INTO role_assignments(account_id,role_code,scope_type,scope_id,state) VALUES
 ('30000000-0000-0000-0000-000000000002','ORG_ADMIN','ORGANIZATION','10000000-0000-0000-0000-000000000101','ACTIVE'),
 ('30000000-0000-0000-0000-000000000003','PLATFORM_OPS','PLATFORM',NULL,'ACTIVE');

INSERT INTO projects(id,type,owner_profile_id,slug,name,summary,status) VALUES
 ('50000000-0000-0000-0000-000000000001','STARTUP','40000000-0000-0000-0000-000000000001','demo-startup','Demo Startup','Deterministic startup for WF02/WF05 handoff.','ACTIVE')
ON CONFLICT DO NOTHING;
INSERT INTO project_members(project_id,profile_id,role_label,state) VALUES
 ('50000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','Founder','ACTIVE')
ON CONFLICT DO NOTHING;

INSERT INTO programmes(id,organization_id,programme_type,slug,name,status) VALUES
 ('60000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000101','CHALLENGE','demo-challenge','Demo Challenge','DRAFT')
ON CONFLICT DO NOTHING;
INSERT INTO events(id,organization_id,programme_id,slug,name,status,starts_at) VALUES
 ('70000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000101',NULL,'demo-event','Demo Event','PUBLISHED',now() + interval '7 days')
ON CONFLICT DO NOTHING;

COMMIT;
