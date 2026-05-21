from django.db import models
from django.contrib.auth.models import AbstractUser
from django.core.validators import MinValueValidator, MaxValueValidator

class User(AbstractUser):
    ROLE_CHOICES = (
        ('ADMIN', 'Admin'),
        ('JUDGE', 'Judge'),
    )
    role = models.CharField(max_length=10, choices=ROLE_CHOICES, default='JUDGE')
    
    @property
    def is_admin(self):
        return self.role == 'ADMIN' or self.is_superuser
        
    @property
    def is_judge(self):
        return self.role == 'JUDGE'
        
    def __str__(self):
        return f"{self.username} ({self.get_role_display()})"


class SchoolClass(models.Model):
    name = models.CharField(max_length=50, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        verbose_name_plural = "School Classes"
        ordering = ['name']
        
    def __str__(self):
        return self.name


class Group(models.Model):
    name = models.CharField(max_length=100)
    project_name = models.CharField(max_length=200)
    school_class = models.ForeignKey(SchoolClass, on_delete=models.CASCADE, related_name='groups')
    judges = models.ManyToManyField(User, related_name='assigned_groups', limit_choices_to={'role': 'JUDGE'}, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        unique_together = ('school_class', 'name')
        ordering = ['school_class', 'name']
        
    def __str__(self):
        return f"{self.name} - {self.project_name} ({self.school_class.name})"
        
    @property
    def average_score(self):
        evals = self.evaluations.all()
        if not evals:
            return 0.0
        return round(sum(e.average_score for e in evals) / len(evals), 2)

    @property
    def total_average_score(self):
        evals = self.evaluations.all()
        if not evals:
            return 0.0
        return round(sum(e.total_score for e in evals) / len(evals), 2)


class GroupMember(models.Model):
    name = models.CharField(max_length=100)
    group = models.ForeignKey(Group, on_delete=models.CASCADE, related_name='members')
    
    class Meta:
        ordering = ['name']
        
    def __str__(self):
        return self.name


class Evaluation(models.Model):
    group = models.ForeignKey(Group, on_delete=models.CASCADE, related_name='evaluations')
    judge = models.ForeignKey(User, on_delete=models.CASCADE, related_name='evaluations')
    
    # 5 Categories scored 1 to 10
    score_functionality = models.IntegerField(
        default=1,
        validators=[MinValueValidator(1), MaxValueValidator(10)]
    )
    score_architecture = models.IntegerField(
        default=1,
        validators=[MinValueValidator(1), MaxValueValidator(10)]
    )
    score_performance = models.IntegerField(
        default=1,
        validators=[MinValueValidator(1), MaxValueValidator(10)]
    )
    score_security = models.IntegerField(
        default=1,
        validators=[MinValueValidator(1), MaxValueValidator(10)]
    )
    score_ui_ux = models.IntegerField(
        default=1,
        validators=[MinValueValidator(1), MaxValueValidator(10)]
    )
    
    comment = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        unique_together = ('group', 'judge')
        ordering = ['-created_at']
        
    def __str__(self):
        return f"Evaluation of {self.group.name} by {self.judge.username}"
        
    @property
    def total_score(self):
        return (
            self.score_functionality +
            self.score_architecture +
            self.score_performance +
            self.score_security +
            self.score_ui_ux
        )
        
    @property
    def average_score(self):
        return round(self.total_score / 5.0, 2)
