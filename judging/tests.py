from django.test import TestCase
from django.core.exceptions import ValidationError
from django.db import IntegrityError
from django.urls import reverse
from django.db.models import Avg
from django.db.models.functions import Coalesce

from judging.models import User, SchoolClass, Group, GroupMember, Evaluation

class UserModelTest(TestCase):
    def test_create_admin_user(self):
        admin = User.objects.create_user(
            username='testadmin',
            password='testpassword123',
            role='ADMIN'
        )
        self.assertEqual(admin.role, 'ADMIN')
        self.assertTrue(admin.is_admin)
        self.assertFalse(admin.is_judge)

    def test_create_judge_user(self):
        judge = User.objects.create_user(
            username='testjudge',
            password='testpassword123',
            role='JUDGE'
        )
        self.assertEqual(judge.role, 'JUDGE')
        self.assertTrue(judge.is_judge)
        self.assertFalse(judge.is_admin)


class EvaluationModelTest(TestCase):
    def setUp(self):
        self.school_class = SchoolClass.objects.create(name='9-A')
        self.judge = User.objects.create_user(
            username='testjudge',
            password='testpassword123',
            role='JUDGE'
        )
        self.group = Group.objects.create(
            name='Team 1',
            project_name='Interactive Solar Map',
            school_class=self.school_class
        )

    def test_valid_evaluation(self):
        evaluation = Evaluation.objects.create(
            group=self.group,
            judge=self.judge,
            score_functionality=8,
            score_architecture=7,
            score_performance=9,
            score_security=6,
            score_ui_ux=8,
            comment='Excellent execution!'
        )
        self.assertEqual(evaluation.total_score, 38)
        self.assertEqual(evaluation.average_score, 7.6)

    def test_invalid_score_range_high(self):
        evaluation = Evaluation(
            group=self.group,
            judge=self.judge,
            score_functionality=11, # Invalid: > 10
            score_architecture=7,
            score_performance=9,
            score_security=6,
            score_ui_ux=8
        )
        with self.assertRaises(ValidationError):
            evaluation.full_clean()

    def test_invalid_score_range_low(self):
        evaluation = Evaluation(
            group=self.group,
            judge=self.judge,
            score_functionality=0, # Invalid: < 1
            score_architecture=7,
            score_performance=9,
            score_security=6,
            score_ui_ux=8
        )
        with self.assertRaises(ValidationError):
            evaluation.full_clean()

    def test_unique_group_judge_constraint(self):
        Evaluation.objects.create(
            group=self.group,
            judge=self.judge,
            score_functionality=8,
            score_architecture=7,
            score_performance=9,
            score_security=6,
            score_ui_ux=8
        )
        
        # Creating a second evaluation for the same group and judge should violate the database constraint
        duplicate_eval = Evaluation(
            group=self.group,
            judge=self.judge,
            score_functionality=5,
            score_architecture=5,
            score_performance=5,
            score_security=5,
            score_ui_ux=5
        )
        with self.assertRaises(IntegrityError):
            duplicate_eval.save()


class LeaderboardAnalyticsTest(TestCase):
    def setUp(self):
        self.school_class = SchoolClass.objects.create(name='10-B')
        self.group = Group.objects.create(
            name='Nebula Tech',
            project_name='Smart Recycling Trashcan',
            school_class=self.school_class
        )
        self.judge1 = User.objects.create_user(
            username='judge1',
            password='password123',
            role='JUDGE'
        )
        self.judge2 = User.objects.create_user(
            username='judge2',
            password='password123',
            role='JUDGE'
        )

    def test_averages_calculation(self):
        # Evaluation 1: Sum = 38, Avg = 7.6
        Evaluation.objects.create(
            group=self.group,
            judge=self.judge1,
            score_functionality=8,
            score_architecture=7,
            score_performance=9,
            score_security=6,
            score_ui_ux=8
        )
        
        # Evaluation 2: Sum = 43, Avg = 8.6
        Evaluation.objects.create(
            group=self.group,
            judge=self.judge2,
            score_functionality=9,
            score_architecture=8,
            score_performance=10,
            score_security=7,
            score_ui_ux=9
        )

        # Re-fetch group with leaderboard calculations
        annotated_group = Group.objects.annotate(
            avg_fun=Avg('evaluations__score_functionality'),
            avg_arc=Avg('evaluations__score_architecture'),
            avg_per=Avg('evaluations__score_performance'),
            avg_sec=Avg('evaluations__score_security'),
            avg_ux=Avg('evaluations__score_ui_ux'),
        ).get(pk=self.group.pk)

        # Average category calculations
        self.assertEqual(annotated_group.avg_fun, 8.5)
        self.assertEqual(annotated_group.avg_arc, 7.5)
        self.assertEqual(annotated_group.avg_per, 9.5)
        self.assertEqual(annotated_group.avg_sec, 6.5)
        self.assertEqual(annotated_group.avg_ux, 8.5)


class RoutePermissionsTest(TestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            username='adminuser',
            password='password123',
            role='ADMIN'
        )
        self.judge = User.objects.create_user(
            username='judgeuser',
            password='password123',
            role='JUDGE'
        )

    def test_unauthenticated_redirect(self):
        response = self.client.get(reverse('admin_dashboard'))
        self.assertRedirects(response, f"{reverse('login')}?next={reverse('admin_dashboard')}")

    def test_judge_cannot_access_admin_dashboard(self):
        self.client.login(username='judgeuser', password='password123')
        response = self.client.get(reverse('admin_dashboard'))
        self.assertEqual(response.status_code, 403)

    def test_admin_cannot_access_judge_dashboard(self):
        self.client.login(username='adminuser', password='password123')
        response = self.client.get(reverse('judge_dashboard'))
        self.assertEqual(response.status_code, 403)

    def test_admin_can_access_admin_dashboard(self):
        self.client.login(username='adminuser', password='password123')
        response = self.client.get(reverse('admin_dashboard'))
        self.assertEqual(response.status_code, 200)

    def test_judge_can_access_judge_dashboard(self):
        self.client.login(username='judgeuser', password='password123')
        response = self.client.get(reverse('judge_dashboard'))
        self.assertEqual(response.status_code, 200)


class AdminManagementTest(TestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            username='adminuser',
            password='password123',
            role='ADMIN'
        )
        self.school_class = SchoolClass.objects.create(name='9-A')
        self.group = Group.objects.create(
            name='Team 1',
            project_name='Interactive Solar Map',
            school_class=self.school_class
        )
        self.judge = User.objects.create_user(
            username='testjudge',
            password='testpassword123',
            role='JUDGE'
        )

    def test_admin_can_add_judge(self):
        self.client.login(username='adminuser', password='password123')
        response = self.client.post(reverse('admin_judges'), {
            'username': 'newjudge',
            'password': 'password123',
            'first_name': 'New',
            'last_name': 'Judge'
        })
        self.assertRedirects(response, reverse('admin_judges'))
        self.assertTrue(User.objects.filter(username='newjudge', role='JUDGE').exists())

    def test_admin_can_delete_judge(self):
        self.client.login(username='adminuser', password='password123')
        response = self.client.post(reverse('admin_judges_delete', args=[self.judge.pk]))
        self.assertRedirects(response, reverse('admin_judges'))
        self.assertFalse(User.objects.filter(username='testjudge').exists())

    def test_admin_can_delete_class(self):
        self.client.login(username='adminuser', password='password123')
        response = self.client.post(reverse('admin_classes_delete', args=[self.school_class.pk]))
        self.assertRedirects(response, reverse('admin_classes'))
        self.assertFalse(SchoolClass.objects.filter(name='9-A').exists())

    def test_admin_can_delete_group(self):
        self.client.login(username='adminuser', password='password123')
        response = self.client.post(reverse('admin_groups_delete', args=[self.group.pk]))
        self.assertRedirects(response, reverse('admin_groups'))
        self.assertFalse(Group.objects.filter(name='Team 1').exists())
