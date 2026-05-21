from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from judging.models import SchoolClass, Group, GroupMember, Evaluation

User = get_user_model()

class Command(BaseCommand):
    help = 'Seeds the database with test data for JudgeHub'

    def handle(self, *args, **options):
        self.stdout.write('Seeding database...')

        # 1. Create Admins
        admin_user, created = User.objects.get_or_create(
            username='admin',
            email='admin@judgehub.com',
            role='ADMIN'
        )
        if created:
            admin_user.set_password('admin123')
            admin_user.is_staff = True
            admin_user.is_superuser = True
            admin_user.save()
            self.stdout.write('Created Admin: admin / admin123')

        # 2. Create Judges
        judge1, created1 = User.objects.get_or_create(
            username='judge1',
            email='judge1@judgehub.com',
            role='JUDGE'
        )
        if created1:
            judge1.set_password('judge123')
            judge1.save()
            self.stdout.write('Created Judge: judge1 / judge123')

        judge2, created2 = User.objects.get_or_create(
            username='judge2',
            email='judge2@judgehub.com',
            role='JUDGE'
        )
        if created2:
            judge2.set_password('judge123')
            judge2.save()
            self.stdout.write('Created Judge: judge2 / judge123')

        # 3. Create Classes
        class_9a, _ = SchoolClass.objects.get_or_create(name='9-A')
        class_10b, _ = SchoolClass.objects.get_or_create(name='10-B')
        class_11d, _ = SchoolClass.objects.get_or_create(name='11-D')
        self.stdout.write('Created School Classes: 9-A, 10-B, 11-D')

        # 4. Create Groups & Members
        # Group 1: Alfa (9-A)
        g_alpha, _ = Group.objects.get_or_create(
            name='Alfa jamoasi',
            project_name='Maktab portali',
            school_class=class_9a
        )
        g_alpha.judges.set([judge1])
        GroupMember.objects.get_or_create(name='Rustam Aliyev', group=g_alpha)
        GroupMember.objects.get_or_create(name='Sardor Karimov', group=g_alpha)
        GroupMember.objects.get_or_create(name='Madina Oripova', group=g_alpha)

        # Group 2: Beta (9-A)
        g_beta, _ = Group.objects.get_or_create(
            name='Beta guruhi',
            project_name='Chiqindilarni saralash AI',
            school_class=class_9a
        )
        g_beta.judges.set([judge2])
        GroupMember.objects.get_or_create(name='Jasur Rahimov', group=g_beta)
        GroupMember.objects.get_or_create(name='Nigora Fayzullayeva', group=g_beta)

        # Group 3: Gamma (10-B)
        g_gamma, _ = Group.objects.get_or_create(
            name='Gamma jamoasi',
            project_name='Aqlli uy boshqaruvchisi',
            school_class=class_10b
        )
        g_gamma.judges.set([judge1, judge2])
        GroupMember.objects.get_or_create(name='Diyorbek Tojiyev', group=g_gamma)
        GroupMember.objects.get_or_create(name='Shahzoda Yodgorova', group=g_gamma)

        # Group 4: Delta (10-B)
        g_delta, _ = Group.objects.get_or_create(
            name='Delta guruhi',
            project_name='Eko-monitoring ilovasi',
            school_class=class_10b
        )
        g_delta.judges.set([judge1])
        GroupMember.objects.get_or_create(name='Umidjon Soliyev', group=g_delta)
        GroupMember.objects.get_or_create(name='Malika Qodirova', group=g_delta)

        # Group 5: Epsilon (11-D)
        g_epsilon, _ = Group.objects.get_or_create(
            name='Epsilon jamoasi',
            project_name='Avtonom robot-labirint',
            school_class=class_11d
        )
        g_epsilon.judges.set([judge1, judge2])
        GroupMember.objects.get_or_create(name='Jahongir Ergashev', group=g_epsilon)
        GroupMember.objects.get_or_create(name='Sabina Rustamova', group=g_epsilon)
        self.stdout.write('Created Groups and added members')

        # 5. Create some sample evaluations
        # judge1 evaluates Group Alpha
        Evaluation.objects.get_or_create(
            group=g_alpha,
            judge=judge1,
            defaults={
                'score_functionality': 8,
                'score_architecture': 7,
                'score_performance': 9,
                'score_security': 6,
                'score_ui_ux': 8,
                'comment': 'Asosiy funksionallik juda yaxshi. UI mustahkam ko\'rinadi, lekin autentifikatsiyani yaxshilash orqali xavfsizlikni kuchaytirish mumkin.'
            }
        )

        # judge2 evaluates Group Beta
        Evaluation.objects.get_or_create(
            group=g_beta,
            judge=judge2,
            defaults={
                'score_functionality': 9,
                'score_architecture': 9,
                'score_performance': 8,
                'score_security': 7,
                'score_ui_ux': 9,
                'comment': 'Ajoyib kod arxitekturasi va qayta ishlatiluvchanlik. Toza Tailwind uslublari.'
            }
        )

        # judge2 evaluates Group Gamma
        Evaluation.objects.get_or_create(
            group=g_gamma,
            judge=judge2,
            defaults={
                'score_functionality': 7,
                'score_architecture': 6,
                'score_performance': 7,
                'score_security': 8,
                'score_ui_ux': 6,
                'comment': 'Yaxshi samaradorlik va xavfsiz parollarni xeshlash. UI biroz sodda, boshqaruv panelini qayta ko\'rib chiqish kerak.'
            }
        )

        self.stdout.write('Created sample evaluations')
        self.stdout.write(self.style.SUCCESS('Successfully seeded database with test data!'))
